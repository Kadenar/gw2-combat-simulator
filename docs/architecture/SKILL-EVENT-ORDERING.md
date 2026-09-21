# Skill event priority and ordering

This document explains how rotations, scheduler tasks, and resolver events are ordered. The simulator does not assign a
priority score to skills or choose the next skill automatically. Priority is an internal tie-breaker for work that has
already been placed on the timeline.

## Execution pipeline

```text
rotation commands
  -> scheduler and private task queue
  -> canonical scheduled events
  -> resolver event queue
  -> damage, conditions, state changes, and reactions
```

The scheduler and resolver have separate queues. A priority in one queue has no direct effect on the other.

## Rotation order is not event priority

Rotation commands are consumed in their authored order. Cast duration, cooldowns, ammo, lockouts, waits, interrupts, and
explicit concurrent offsets determine when each command can execute.

Event priority does not:

- reorder rotation commands;
- bypass skill availability or cooldowns;
- move an event ahead of an earlier resolver timestamp; or
- make one skill generally more important than another.

Use the rotation and its timing fields to describe player decisions. Use event priority only to describe causal ordering
between simultaneous effects.

## Resolver event ordering

The resolver processes canonical events in this order:

1. canonical integer microsecond timestamp, ascending;
2. internal phase: Sample, Settle, then Ordinary;
3. `priority`, ascending;
4. finite `causalOrder`, falling back to `eventOrder` when `causalOrder` is absent, ascending (untagged/nonfinite
   ordering metadata sorts after finite values); and
5. stable insertion order when the preceding fields tie.

A missing priority is treated as `0`. Lower numbers run first, so `-10` runs before `0`, and `0` runs before `10`.
Priority only changes the order of events with the same timestamp and phase. Authors cannot override phases.

Public events retain seconds, rounded to the nearest microsecond before emission and resolver ingress. Integer keys make
arithmetic aliases such as `0.56 + 0.04` and `0.6` equal without merging adjacent microseconds. Nonfinite or unsafe
timestamps are rejected. This is numerical normalization, not a change to authored strike grids or projectile delays.
Observation cutoffs are inclusive at the canonical instant; delayed completion effects need an explicit observation
tail.

`EPSILON` is only a tolerance for comparisons at numeric boundaries. Never add or subtract it from `at`, `duration`, or
`expiresAt` to express ordering. Synthetic 0.1 ms gaps create false gameplay time and bypass the queue's ordering
contract. The 40 ms action tick is also mechanic-specific; it is not a replacement for same-time priority.

```text
at=1.000, priority=-10
at=1.000, priority=0
at=1.000, priority=10
at=1.100, priority=-100  # still last because its timestamp is later
```

Most ordinary skill packets use the default priority. Explicit priorities are for same-time state dependencies, such as
opening a window before a hit, consuming a resource before replacing it, or closing a window after all eligible packets.

## Common same-time patterns

### State around a skill packet

For a state transition that must surround an ordinary priority-zero skill packet:

```ts
context.emit({
  type: 'example.window-open',
  at,
  priority: -10,
  source: 'example',
  sourceId: skill.id,
  actorType: 'player'
});

// The ordinary skill packet resolves here at priority 0.

context.emit({
  type: 'example.window-close',
  at,
  priority: 10,
  source: 'example',
  sourceId: skill.id,
  actorType: 'player'
});
```

The priorities express only these two inequalities:

```text
open < skill packet < close
```

### Consume, trigger, then replace

A mechanic that consumes existing state, creates a triggered packet, and grants replacement state can use three ordered
lanes:

```text
-20  consume existing state
-15  resolve the triggered packet
-10  grant replacement state
  0  resolve ordinary skill packets
```

The exact numbers are local implementation details. The required relationships are what matter. There is no global enum
of reserved event-priority lanes.

## Causal and insertion order

The scheduler assigns every emitted event a monotonic `eventOrder`. `emitDerived(cause, event)` also assigns a
fractional `causalOrder` immediately after the root cause. This keeps scheduler-materialized combo results, procs, and
other derived facts next to their cause when timestamp and priority tie.

Events created during resolution must be added with `enqueueOrdered()`. If such an event does not provide explicit
causal metadata, the stable queue places it with the event currently being handled. Stable insertion order then resolves
any remaining tie.

### Shared condition pulses

All conditions follow pulses at 1s, 2s, and so on after first positive player damage. Sample reads all owners at
whole-second pulses and exact natural expirations. Settle commits condition payouts and their same-time derived state.
Ordinary then runs strikes, direct condition-kind damage, and ordinary state events. A negative ordinary priority cannot
precede settlement. An eligible condition payout takes precedence over a first strike at the same timestamp and
establishes first damage. Before an opener, provisional encounter-second pulses allow conditions to establish first
damage themselves. A direct opener between those pulses replaces pending wakes with the first-damage phase; an explicit
Combat Start marker only gates damage.

Non-damage events emitted during settlement inherit Settle only at that timestamp; future work receives its normal
phase. Direct damage remains Ordinary. Enqueueing work in the past or in an earlier phase at the current timestamp
throws with the source and time. A bounded same-time chain prevents runaway reactions. Within each phase, existing
priority and causal ordering remain unchanged.

Each owner/condition packet commits all contributions before its tick reaction and the event loop's death check.
Distinct groups remain separately ordered, including simultaneous packets at the lethal timestamp. Applications at a
pulse boundary contribute zero buffered time to the preceding interval. Each application samples current stats and
modifiers for its elapsed interval without rounding; whole-second packets sum all contributions for the same condition
and owner, round half-even once, and commit those contributions. All owners sample the boundary before any condition
payout changes target health. Natural expiry between pulses settles on the next synchronized pulse, not at expiry or the
observation cutoff. See [Shared condition ticks](SHARED-CONDITION-TICKS.md).

Status queries use canonical half-open windows: active at application, inactive at expiry. Accrual ending at expiry may
still enter a later payout; forced removal discards pending damage separately from natural expiration.

Standard boon and condition durations round half-even to whole milliseconds after duration bonuses, including
fixed-duration grants. Boon extension amounts use the same rounding. Temporary buff expiry follows the shared effect
clock and rounds up to the next absolute 40 ms boundary; condition natural expiry remains exact. Duration-stacking boon
grants add to the remaining pool before its cap is applied. Generic profession buff events retain their authored
duration even though their active window uses the shared effect-expiry policy.

Do not depend on incidental array order. Use:

- a different `at` value for a real time difference;
- `priority` for a same-time state dependency; and
- `emitDerived()` or resolver queue inheritance for cause-and-effect adjacency.

## Scheduler task priority

Scheduler tasks are private bookkeeping work. They update cooldowns, resources, persistent actors, materialized proc
facts, and other scheduler state before the canonical event stream is handed to the resolver. They never enter the
resolver event queue.

Tasks are ordered by:

1. canonical timestamp, with distinct microseconds remaining distinct;
2. ascending priority; and
3. insertion order.

Task draining never executes beyond its canonical target. Continuous resource retry estimates round upward to the next
representable ready instant. Mesmer direct clone grants, phantasm conversions, shatter refunds, Harmonize, Tales, and
Bloodsong resource tasks use their actual completion timestamp; task ordering replaces synthetic delays.

Current platform examples include core cast completion at `-100`, shared trigger materialization at `-60`, combo
materialization at approximately `-59`, and a default of `0`. These are existing relative placements, not a public set
of reserved lanes. Profession tasks should choose a priority only when they have a demonstrated dependency on same-time
work.

Task priority can affect which canonical events are produced and their emission order. Once produced, however, those
events are independently ordered by resolver event priority.

## Other fields named order or priority

These mechanisms are independent:

| Field                    | Scope                                    | Direction           |
| ------------------------ | ---------------------------------------- | ------------------- |
| Event `priority`         | Same-time resolver events                | Lower runs first    |
| Task `priority`          | Same-time scheduler tasks                | Lower runs first    |
| Hook or reaction `order` | Handlers in one lifecycle/reaction phase | Lower runs first    |
| Modifier-rule `order`    | Rules within one modifier target/formula | Lower applies first |
| `comboBindingPriority`   | Selecting an authoritative combo field   | Higher wins         |

Hook order does not move events on the timeline. Modifier order does not determine which damage event resolves first.
`comboBindingPriority` selects a field and deliberately uses the opposite numeric direction from queue priority.

## Authoring rules

1. Leave events at priority `0` unless a same-time state dependency requires otherwise.
2. Put real delays in `at`; do not simulate elapsed time with priority.
3. Never use `EPSILON` to move an event, task, duration, or expiry. Use it only as a documented comparison tolerance.
4. Set priority on the emitted event or procedural skill-event options. Ordinary declarative effects use the default
   event priority.
5. Keep priority relationships local to the owning mechanic and comment what must happen before or after what.
6. Add resolver-created events with `enqueueOrdered()`, never a raw array push.
7. Use hook or reaction `order` when ordering handlers for the same event; do not manufacture another event solely to
   order callbacks.
8. Test the smallest simultaneous-event scenario that proves the required state or packet order.

## Implementation references

- `js/kernel/events/queue.ts` owns resolver event comparison and the stable event heap.
- `js/games/gw2/platform/execution/tasks.ts` owns scheduler task comparison.
- `js/games/gw2/platform/execution/scheduled-events.ts` assigns `eventOrder`, creates `causalOrder`, and the scheduler
  sorts the handoff.
- `js/games/gw2/platform/resolver/event-loop.ts` drains the resolver queue.
- `tests/games/gw2/platform/engine/event-ordering.test.js` covers event priority, causal order, and stability.
- `tests/games/gw2/platform/engine/scheduler-temporal.test.js` covers task priority and insertion order.
