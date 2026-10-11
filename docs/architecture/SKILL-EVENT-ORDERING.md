# Skill event priority and ordering

Commands, internal tasks, and combat packets execute on one clock and one stable heap. Priority orders already scheduled
work; it does not select the next skill. `simulateGw2()` invokes this runtime for all application and analysis
consumers.

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

## Shared work ordering

The runtime processes queued work in this order:

1. canonical integer microsecond timestamp, ascending;
2. internal phase: Sample, Settle, then Ordinary;
3. `priority`, ascending;
4. finite `causalOrder`, falling back to `eventOrder` when `causalOrder` is absent, ascending (untagged/nonfinite
   ordering metadata sorts after finite values); and
5. stable insertion order when the preceding fields tie.

A missing priority is treated as `0`. Lower numbers run first, so `-10` runs before `0`, and `0` runs before `10`.
Priority only changes the order of events with the same timestamp and phase. Authors cannot override phases.

Public events retain seconds, rounded to the nearest microsecond before queue ingress. Integer keys make arithmetic
aliases such as `0.56 + 0.04` and `0.6` equal without merging adjacent microseconds. Nonfinite or unsafe timestamps are
rejected. This is numerical normalization, not a change to authored strike grids or projectile delays. Observation
cutoffs are inclusive at the canonical instant; delayed completion effects need an explicit observation tail.

Clock comparisons use exact canonical instants. Never add or subtract a tolerance from `at`, `duration`, or `expiresAt`
to express ordering. Synthetic 0.1 ms gaps create false gameplay time and bypass the queue's ordering contract. The 40
ms action tick governs cast admission and reservations; same-time work still uses explicit queue priority.

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
context.effects.emit({
  kind: 'packet',
  event: {
    type: 'example.window-open',
    at,
    priority: -10,
    source: 'example',
    sourceId: skill.id,
    actorType: 'player'
  }
});

// The ordinary skill packet resolves here at priority 0.

context.effects.emit({
  kind: 'packet',
  event: {
    type: 'example.window-close',
    at,
    priority: 10,
    source: 'example',
    sourceId: skill.id,
    actorType: 'player'
  }
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

Combat emission assigns a monotone `eventOrder`. `runtime.effects.emit({ kind: 'packet', cause, event })` places an
effect with its cause; the runtime also inherits current causal placement for untagged derived work. Announcements use a
separate identity counter so reporting cannot change combat order or randomness. Stable insertion order breaks ties. New
authored commands begin new causal roots after due work settles. Internal payloads never appear in public logs.

### Shared condition pulses

Sample reads condition rates before Settle commits payouts and same-time derived state. Ordinary then runs strikes,
direct condition-kind damage, and ordinary state events. A negative Ordinary priority cannot precede settlement. All
condition owners sample a boundary before any payout changes target health, and each owner/condition group commits
atomically before its tick reaction and death check.

Non-damage events emitted during settlement inherit Settle only at that timestamp; future work receives its normal
phase. Direct damage remains Ordinary. Enqueueing past work or rewinding the current phase throws; a bounded same-time
chain prevents runaway reactions. Priority and causal ordering still break ties within each phase.

[Shared condition ticks](SHARED-CONDITION-TICKS.md) owns the first-damage-relative pulse, expiry accrual, grouped
rounding, and death-boundary contracts. The [event clock](SIMULATION-EVENT-CLOCK.md#8-status-and-condition-clocks)
defines half-open status windows and duration rounding.

Do not depend on incidental array order. Use:

- a different `at` value for a real time difference;
- `priority` for a same-time state dependency; and
- an explicit emission `cause` or inherited runtime causality for cause-and-effect adjacency.

## Internal task priority

Internal tasks share event phases, priority, causal placement, and stable insertion order with combat packets. Cast
completion uses priority -100 so recharge commits before ordinary completion packets. Named profession tasks choose
priorities only for a documented dependency. Fields use -1 and finishers/outcomes -0.5 so a hit sees its actual combo
effects. These are local ordering relationships, not separate queues or reserved public priority lanes.

Tasks carry detached data and optional owner generations. Cancel obsolete lifetime work explicitly; activation
attribution alone must not erase a committed projectile. Resource wakes are recalculated when rate or capacity changes.

## Other fields named order or priority

These mechanisms are independent:

| Field                    | Scope                                    | Direction           |
| ------------------------ | ---------------------------------------- | ------------------- |
| Event `priority`         | Same-time queued events                  | Lower runs first    |
| Task `priority`          | Same-time internal tasks                 | Lower runs first    |
| Hook or reaction `order` | Handlers in one lifecycle/reaction phase | Lower runs first    |
| Modifier-rule `order`    | Rules within one modifier target/formula | Lower applies first |
| `comboBindingPriority`   | Selecting an authoritative combo field   | Higher wins         |

Hook order does not move events on the timeline. Modifier order does not determine which damage event resolves first.
`comboBindingPriority` selects a field and deliberately uses the opposite numeric direction from queue priority.

## Authoring rules

1. Leave events at priority `0` unless a same-time state dependency requires otherwise.
2. Put real delays in `at`; do not simulate elapsed time with priority.
3. Compare canonical deadlines exactly. Never use a tolerance to move or extend an event, task, duration, or expiry.
4. Set priority on the emission request or emitted event. Ordinary declarative effects use the default event priority.
5. Keep priority relationships local to the owning mechanic and comment what must happen before or after what.
6. Submit derived effects through `runtime.effects.emit({ kind: 'packet', cause, event })`; use `kind: 'profile'` for
   authored effects and `kind: 'announcement'` for reporting-only activations. Producers must not insert directly into
   the queue or event arrays.
7. Use hook or reaction `order` when ordering handlers for the same event; do not manufacture another event solely to
   order callbacks.
8. Test the smallest simultaneous-event scenario that proves the required state or packet order.

## Implementation references

- `js/kernel/events/queue.ts` owns stable phased ordering and cancellation.
- `js/games/gw2/platform/simulation/coordinator.ts` owns queue dispatch and clock advancement.
- `js/games/gw2/platform/execution/cast-execution.ts` owns command acceptance and cast lifecycle.
- `js/games/gw2/platform/simulation/internal-work.ts` validates private payloads and ownership.
- `tests/games/gw2/platform/events/event-ordering.test.js` covers ordering contracts.
