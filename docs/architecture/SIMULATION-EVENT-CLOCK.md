# Simulation event clock specification

This document defines the timeline contract used by the current simulation engine. It covers timestamp representation,
rotation scheduling, internal tasks, emitted events, resolver ordering, observation boundaries, and condition pulses.

The clock is a deterministic logical clock. It is not wall-clock time, and the engine does not advance in fixed-size
steps.

## Contract summary

| Property | Contract |
| --- | --- |
| Internal time unit | Seconds |
| Rotation and skill metadata | Milliseconds where the field name ends in `Ms`; cooldown and effect durations are seconds |
| Canonical precision | One microsecond |
| General event progression | Jump directly to the next command, task, event, or final boundary |
| Event horizon | Inclusive: an event exactly at the resolution end is processed |
| Status lifetime | Half-open: `[startsAt, expiresAt)` |
| Task ordering | Timestamp, ascending priority, insertion order |
| Resolver ordering | Timestamp, resolver phase, ascending priority, causal order, insertion order |
| Default observation | Through the end of the entered rotation |
| Runaway-work limit | 100,000 rotation commands, task executions, same-time resolver events, or observation emissions, depending on the loop |

## 1. Canonical time

Public events carry seconds in `event.at`. Most rotation authoring fields use milliseconds and are divided by `1000`
when placed on the internal timeline.

Every timestamp that enters the clock is canonicalized as follows:

```text
timeKey(seconds)      = round(seconds * 1,000,000)
canonicalTime(seconds) = timeKey(seconds) / 1,000,000
```

`timeKey` must be a safe integer and the input must be finite. This gives the clock exact, transitive equality at one
microsecond without forcing events onto a coarser combat grid. For example, `0.56 + 0.04` and `0.6` are the same
instant, while `0.600000` and `0.600001` remain distinct.

Platform events additionally require a non-negative finite `at` value. They also require `type`, `source`, `sourceId`,
and `actorType`. Common event types are registered by the platform; a custom type must contain a period, such as
`profession.effect`.

### Floating-point tolerance

`EPSILON` is `0.0001` seconds, or 100 microseconds. It is used for readiness and boundary comparisons where metadata
may contain floating-point residue. It is not the clock resolution and is not used to merge or sort events. Queue
ordering always uses canonical microsecond keys.

### The 40 ms GW2 action tick

The global event clock is not a 40 ms clock. The GW2 action-tick value is applied only where a mechanic explicitly
requires it:

- imported observed action timing can be rounded to the nearest 40 ms;
- calculated positive action durations can be rounded up to the next 40 ms;
- summon Quickness timing uses the 1.5 action-rate conversion and rounds up to an action tick unless an explicit
  measured duration exists;
- temporary effect expiry is rounded up to the next absolute 40 ms boundary.

All other authored packet timestamps remain on the canonical microsecond timeline.

## 2. Two passes over one logical timeline

The simulation runs in two phases:

1. The scheduler executes rotation commands, advances profession and shared state, runs private tasks, and emits an
   immutable chronological event stream.
2. The resolver replays that stream, applies damage and conditions, runs event reactions, and stops at the resolution
   horizon or target death.

The scheduler and resolver do not share mutable combat state. Resolver state starts at time zero and reconstructs the
result by consuming scheduler events in order. Scheduler-only predictions used to make rotation decisions can be
removed before resolver replay when resolver reactions own the real outcome.

## 3. Scheduler clock

The scheduler owns `state.time`. Time never moves backward.

Conceptually, `advanceTo(target)` performs this loop:

```text
target = canonicalTime(max(state.time, target))

while next task time <= target:
    next = max(state.time, next task time)
    advance continuous shared, policy, and profession state to next
    state.time = next
    drain every task due through next

advance continuous shared, policy, and profession state to target
state.time = target
drain tasks created at or before target by the final advancement
```

Continuous state is advanced before discrete tasks at the same timestamp. A task handler may enqueue more work at its
current timestamp; that work is drained before the clock moves forward.

### Private task queue

Tasks mutate scheduler state and never enter the resolver event stream. A task has:

- a finite canonical `at` timestamp;
- a non-empty registered `type` unless explicitly optional;
- an ascending numeric `priority`, defaulting to `0`;
- stable insertion `order`;
- an optional `ownerId` for cancellation;
- a structured-cloneable payload.

Tasks sort by canonical timestamp, then priority, then insertion order. Lower priorities run first. Cast completion uses
priority `-100`, so cooldown/ammo commitment and cast-completion hooks run before ordinary same-time tasks.

A task cannot be scheduled before `state.time`. Scheduling at the current instant is allowed. Cancellation suppresses
queued work; cancelling an owner does not prevent new tasks from later using that owner ID.

### Emission is not resolution

When a cast is accepted, all declarative event packets for that activation can be emitted immediately, including
packets whose `at` time is in the future. Scheduler event observers also run immediately in a FIFO observation queue.
Code querying emitted history must therefore compare the event's `at` and lifetime against the query time; presence in
the array does not mean the event has happened yet.

## 4. Rotation commands and cast lanes

Rotation input is normalized strictly into four command types: `cast`, `wait`, `combat-start`, and `cooldown-reset`.
Malformed commands stop the run. Unknown or non-retryably unavailable skills instead produce invalid steps and
warnings.

The scheduler tracks separate timing lanes:

- ordinary player casts use the serial cast lane;
- instant player skills may overlap a cast when their metadata permits it, but preserve command order and wait until
  the actual interruption point of preceding work;
- independent actors, such as summons, use a separate serial lane unless the skill explicitly permits independent
  overlap;
- waits and the final rotation boundary remain behind every outstanding reservation on every lane.

A concurrent command's `concurrentOffsetMs` is anchored to the previous player cast's start. It is not relative to the
current clock or the previous cast's end. If the requested instant has already passed for an instant or independent
action, it is moved to the current clock rather than backdating the event.

An ordinary wait begins only after `state.time`, the serial lane, and every outstanding cast reservation have reached
the same point. Its end is:

```text
waitEnd = waitStart + durationMs / 1000
```

### Cast timestamps

For an accepted cast:

```text
start        = earliest time allowed by its lane, input recovery, cooldowns, resources, and profession rules
fullEnd      = canonicalTime(start + effectiveCastDurationSeconds)
effectiveEnd = fullEnd, or min(fullEnd, canonicalTime(start + interruptAfterMs / 1000))
```

`castTimeMs` is already the effective player duration stored in skill metadata. Shared game rules then profession rules
may modify the duration. Only independent summon casts apply runtime Quickness conversion in the shared policy.

An interrupted skill can reserve the lane through `fullEnd` when its metadata says a committed interruption retains
the remaining cast as aftercast. Otherwise it releases the lane at `effectiveEnd`. The action event is emitted at
`start`; the cast-completion task runs at `effectiveEnd`.

### Effect packet timestamps

An effect packet uses either `castStart` or `castEnd` as its origin. `castEnd` means `fullEnd`, including for an
interrupted cast. The default origin is cast end. An effect with neither a packet offset nor explicit ticks occurs at
`fullEnd`.

```text
packetAt = origin + atMs / 1000
repeatAt = firstPacketAt + (applicationIndex - 1) * intervalMs / 1000
```

Explicit tick arrays supply each packet's own offset. Aggregate multi-hit strikes share one timestamp. Cast-scaled
effects project offsets onto the runtime cast duration; fixed effects preserve wall-clock offsets.

Interruption filtering is applied after materialization. Per-packet channels keep packets through
`effectiveEnd + EPSILON` and discard later packets. Commit-mode effects follow their skill/effect commit cutoff and
persistence metadata.

### Cooldown and ammo timestamps

Recharge duration is selected from ordinary cooldown metadata or ammo recharge metadata, then modified by shared game
rules and profession rules. The default recharge anchor is `effectiveEnd`; `rechargeAnchor: "castStart"` selects
`start`.

```text
baseRechargeStart = selectedAnchor + rechargeOffsetMs / 1000
rechargeStart     = max(start, professionModifiedRechargeStart)
ordinaryReadyAt   = rechargeStart + rechargeDuration
```

Cooldown and ammo state commits in the completion task at `effectiveEnd`, even when the computed recharge anchor is
earlier. Alacrity is sampled when recharge begins, not necessarily when the cast begins. Ammo charge recharge and the
optional between-cast ammo lockout are independent deadlines; availability uses the later applicable deadline.

Retryable availability does not fail the command. The clock advances to the earlier of the declared retry time and the
next state-changing task, then checks again. A fractional retry time is rounded up to the first representable
microsecond strictly after the current clock. A non-retryable denial records an invalid zero-duration step.

Ordinary cooldown availability treats a deadline within `EPSILON` of the query time as ready. Internal proc cooldowns
use a stricter contract: a previously armed cooldown remains blocked at its exact `readyAt` boundary and becomes ready
only at a later timestamp. The sentinel `readyAt = 0` means never armed and is ready at time zero.

## 5. Rotation end and observation end

The scheduler distinguishes the entered rotation from the period resolved for delayed effects.

`rotationEndTime` is the canonical maximum of the current scheduler time, the serial lane, and every outstanding cast
reservation. Final input recovery is included. It does not automatically extend to every delayed damage packet.

`resolutionEndTime` is selected by the observation policy:

| Policy | Resolution end |
| --- | --- |
| omitted or `{ kind: "rotation" }` | `rotationEndTime` |
| `{ kind: "tail", durationMs }` | `rotationEndTime + durationMs / 1000` |
| `{ kind: "absolute", endTimeMs }` | `max(rotationEndTime, endTimeMs / 1000)` |

Durations and absolute endpoints must be non-negative and finite. An absolute endpoint more than `EPSILON` before the
rotation end is rejected. A tail is applied once; recurring work inside the tail does not recursively extend it.

The scheduler advances private tasks through `resolutionEndTime`, allowing finite recurring actors and mechanics to
emit their tail events. The resolver then uses the same value as its inclusive horizon. Consequently, a packet exactly
at the horizon is processed and a packet one microsecond later is not.

## 6. Event stream ordering

Every scheduler emission receives a monotone integer `eventOrder`. Scheduler-derived events receive a `causalOrder`
equal to the integer order of their root cause plus successive `1 / 1,000,000` suffixes. This places same-time derived
events beside their cause without changing their timestamp.

Before handoff, scheduler history is sorted by:

1. canonical timestamp;
2. ascending priority, default `0`;
3. `causalOrder`, otherwise `eventOrder`;
4. stable insertion order.

Missing or non-finite causal metadata is the untagged tier and sorts after finite causal placement. Explicit
`causalOrder` takes precedence over `eventOrder`.

The handoff stream is immutable and versioned as:

```text
kind:               "gw2.simulation.events"
version:            1
eventSchemaVersion: 1
source:              "platform.engine.scheduler"
events:              frozen chronological event array
rotationEndTime:     canonical seconds
resolutionEndTime:   canonical seconds, >= rotationEndTime
resolverHandoff:     combat-start metadata
```

## 7. Resolver clock and phases

The resolver loads the stream into a stable min-heap. Its complete ordering key is:

```text
(canonical timestamp, private phase, priority, causal placement, insertion sequence)
```

GW2 defines three private phases:

| Phase | Value | Events |
| --- | ---: | --- |
| Sample | 0 | `condition_buffer` |
| Settle | 1 | `condition_tick`; non-damage work derived while settling the same instant |
| Ordinary | 2 | all other events, including direct damage |

Phase outranks event priority. At one timestamp, condition state is therefore sampled first, condition damage settles
second, and ordinary strikes and actions resolve last. Within a phase, lower priority runs first, then causal placement,
then insertion order.

Resolver-generated events inherit the currently executing event's causal placement unless they provide an explicit
one. The queue rejects an event before the current time and rejects a same-time event in an earlier phase. A future
timestamp may begin again at any phase.

The resolver loop is:

```text
while the queue is not empty:
    remove the earliest event
    stop if event.at > resolution horizon
    apply target-death, target-eligibility, and combat-start gates
    dispatch the registered handler
    publish selected state events for later timeline queries
    detect target death after the handler
```

An unknown required custom event type is an error. A common event with no registered handler is inert.

### Combat start, damage, and death

With an explicit Combat Start, outgoing damage, condition ticks, and combo resolution before the marker are gated.
Condition applications may still be processed before combat so surviving stacks can cross the boundary. Combat-start
boundary metadata is published before tasks at its timestamp are drained; the `combat_start` event itself is emitted
after that drain. This allows boundary-time hits to trigger combat effects.

Target death clips the effective reporting end. Events after the death timestamp are not processed. At the lethal
timestamp, the resolver finishes sibling packets from the same activation and the simultaneous condition-tick batch,
but skips a distinct later attack.

DPS time does not necessarily start at zero or Combat Start. It starts at the first surviving positive player-damage
event. Explicit Combat Start supplies only the damage-free fallback and the precombat gate. The DPS window is:

```text
effectiveEnd = deathTime ?? resolutionEndTime
dpsStart     = firstHitTime ?? (hasExplicitCombatStart ? combatStartTime : 0)
dpsWindow    = max(0, effectiveEnd - dpsStart)
```

## 8. Status and condition clocks

Timed status queries use exact canonical half-open windows:

```text
active(at) = startsAt <= at && at < expiresAt
```

A status is active at its application timestamp and inactive at its expiry timestamp. Standard boon durations are
rounded to whole milliseconds using half-even rounding after duration modifiers. Their actual expiry is then rounded
up to the next absolute 40 ms action-tick boundary.

Conditions use the encounter's integer-second clock, not a timer relative to the first damage event:

- the first payout for a condition applied at `t` is at `floor(t) + 1`;
- one owner/condition group shares a wake and is rounded as one damage packet;
- condition rates are sampled at whole-second boundaries and at exact off-grid expirations;
- an off-grid expiry remainder is buffered and paid at the group's next whole-second wake;
- applications are semantically active through `[appliedAt, naturalExpiresAt)`;
- the observation horizon clips scheduled damage but does not change the application's natural semantic expiry;
- ambient target conditions tick at `1, 2, ... floor(resolutionEndTime)`.

The Sample phase runs before the Settle phase at a shared second, so all condition owners use one coherent target-state
sample before any condition payout changes health.

## 9. Boundary examples

### Same canonical instant

These values share one clock key and are ordered by phase/priority/causality rather than floating-point residue:

```text
0.56 + 0.04 seconds -> 600000 -> 0.600000 seconds
0.60 seconds        -> 600000 -> 0.600000 seconds
```

An event at `0.600001` remains a later event.

### Horizon

For `resolutionEndTime = 2.000000`:

```text
event.at = 2.000000  processed
event.at = 2.000001  excluded
```

### Status expiry

For a status with `startsAt = 1.0` and `expiresAt = 2.0`:

```text
at = 1.0       active
at = 1.999999  active
at = 2.0       inactive
```

### Same-time resolver work

At `t = 3.0`, the resolver processes a condition buffer first, condition ticks second, and ordinary damage last,
regardless of an ordinary event's lower numeric priority.

## 10. Safety and determinism

The engine fails instead of silently truncating runaway work:

- more than 100,000 normalized rotation commands is rejected;
- scheduler availability and final input-recovery loops are capped at 100,000 iterations;
- the task queue is capped at 100,000 processed tasks and detects excessive same-time task chains;
- scheduler event-observer recursion is flattened and capped at 100,000 emissions per observation drain;
- the phased resolver queue detects more than 100,000 dequeues at one timestamp;
- enqueueing past work or rewinding a same-time resolver phase throws.

Stable insertion ordering and queue-local causal inheritance keep independent simulations deterministic. Stochastic
combat choices are a separate seeded-randomness concern and do not alter the clock contract.

## Source of truth

- [Clock primitives](../../js/kernel/core/clock.ts)
- [Stable event queue](../../js/kernel/events/queue.ts)
- [Observation policy](../../js/kernel/execution/observation.ts)
- [Scheduler](../../js/games/gw2/platform/engine/execution/scheduler.ts)
- [Scheduler task queue](../../js/games/gw2/platform/engine/execution/tasks.ts)
- [Effect materialization](../../js/games/gw2/platform/engine/effects/materializer.ts)
- [Scheduled stream contract](../../js/games/gw2/platform/engine/events/scheduled-stream.ts)
- [Resolver event loop](../../js/games/gw2/platform/resolver/event-loop.ts)
- [Condition resolution](../../js/games/gw2/platform/resolver/condition-resolution.ts)
- [GW2 timing helpers](../../js/games/gw2/platform/skills/timing.ts)
