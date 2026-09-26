# Simulation event clock specification

This document defines the timeline contract used by the current simulation engine. It covers timestamp representation,
rotation scheduling, internal tasks, emitted events, resolver ordering, observation boundaries, and condition pulses.

The clock is a deterministic logical clock. It is not wall-clock time, and the engine does not advance in fixed-size
steps.

## Contract summary

| Property                    | Contract                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| Internal time unit          | Seconds                                                                                       |
| Rotation and skill metadata | Milliseconds where the field name ends in `Ms`; cooldown and effect durations are seconds     |
| Canonical precision         | One microsecond                                                                               |
| General event progression   | Jump directly to the next command, task, event, or final boundary                             |
| Event horizon               | Inclusive: an event exactly at the resolution end is processed                                |
| Status lifetime             | Half-open: `[startsAt, expiresAt)`                                                            |
| Task ordering               | Timestamp, phase, ascending priority, causal order, insertion order                           |
| Resolver ordering           | Timestamp, phase, ascending priority, causal order, insertion order                           |
| Default observation         | Through the end of the entered rotation                                                       |
| Runaway-work limit          | 100,000 normalized commands, runtime iterations, or same-time dequeues, depending on the loop |

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

`EPSILON` is `0.0001` seconds, or 100 microseconds. It is used for readiness and boundary comparisons where metadata may
contain floating-point residue. It is not the clock resolution and is not used to merge or sort events. Queue ordering
always uses canonical microsecond keys.

### The 40 ms GW2 action tick

The global event clock is not a 40 ms clock. The GW2 action-tick value is applied only where a mechanic explicitly
requires it:

- imported observed action timing can be rounded to the nearest 40 ms;
- calculated positive action durations can be rounded up to the next 40 ms;
- summon Quickness timing uses the 1.5 action-rate conversion and rounds up to an action tick unless an explicit
  measured duration exists;
- temporary effect expiry is rounded up to the next absolute 40 ms boundary.

All other authored packet timestamps remain on the canonical microsecond timeline.

## 2. One live runtime

`simulateGw2()` validates input and invokes `simulation/runtime.ts` once. One command cursor, stable heap, profession
instance, target state, resource controller, and RNG own execution. Score and detailed outputs share this execution;
only retained reporting collections differ.

## 3. Runtime clock

Time advances to the next queued event, command readiness boundary, or observation end. Continuous resources and
cooldowns settle before discrete work at that instant. Due work drains before another command is accepted. Accepted
casts reserve their lanes and enqueue packets and completion work; pending packets are not visible history. Only
executed state facts enter combat queries. Resource gains from a hit therefore affect the next command directly.

Internal tasks use the same heap as damage and conditions. Payloads are detached, serializable data, and handlers are
registered once. An optional owner generation cancels obsolete lifetime work. Activation identity attributes a cast; it
does not automatically cancel a projectile that has already committed.

## 4. Rotation commands and cast lanes

Rotation input is normalized strictly into four command types: `cast`, `wait`, `combat-start`, and `cooldown-reset`.
Malformed commands stop the run. Unknown or non-retryably unavailable skills instead produce invalid steps and warnings.

The cursor tracks separate timing lanes:

- ordinary player casts use the serial cast lane;
- instant player skills may overlap a cast when their metadata permits it, but preserve command order and wait until the
  actual interruption point of preceding work;
- independent actors, such as summons, use a separate serial lane unless the skill explicitly permits independent
  overlap;
- waits and the final rotation boundary remain behind every outstanding reservation on every lane.

A concurrent command's `concurrentOffsetMs` is anchored to the previous player cast's start. It is not relative to the
current clock or the previous cast's end. If the requested instant has already passed for an instant or independent
action, it is moved to the current clock rather than backdating the event.

An ordinary wait begins only after `runtime.time`, the serial lane, and every outstanding cast reservation have reached
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

An interrupted skill can reserve the lane through `fullEnd` when its metadata says a committed interruption retains the
remaining cast as aftercast. Otherwise it releases the lane at `effectiveEnd`. The action event is emitted at `start`;
the cast-completion task runs at `effectiveEnd`.

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

### Resource and proc lifecycle

Every resource mutation settles elapsed work at the old rate before changing value, capacity, or rate. Continuous and
discrete resources use the shared controller; stale readiness/depletion wakes carry generations and cannot mutate
replacement lifetimes. Grants are actual executed facts. Charge spending and expiry never replay earlier grants.

Eligibility gates run before critical draws or proc claims. An accepted hit samples one critical outcome, shared by
eligible traits and equipment; secondary proc chances have their own seeded streams and strict ICD deadlines. A derived
strike with a different source owns an independent activation and weapon-strength roll. Related condition/control
packets keep their originating attribution. Recharge entitlements are reserved once at accepted commit-eligible casts;
rejected or pre-commit-cancelled commands leave them available. Diagnostics record these actual decisions.

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

Ordinary cooldown availability uses the shared canonical readiness calculation. Internal proc cooldowns use a stricter
contract: a previously armed cooldown remains blocked at its exact `readyAt` boundary and becomes ready only at a later
timestamp. The sentinel `readyAt = 0` means never armed and is ready at time zero.

## 5. Rotation end and observation end

The runtime distinguishes the entered rotation from the period resolved for delayed effects.

`rotationEndTime` is the canonical maximum of the current runtime time, the serial lane, and every outstanding cast
reservation. Final input recovery is included. It does not automatically extend to every delayed damage packet.

`resolutionEndTime` is selected by the observation policy:

| Policy                            | Resolution end                           |
| --------------------------------- | ---------------------------------------- |
| omitted or `{ kind: "rotation" }` | `rotationEndTime`                        |
| `{ kind: "tail", durationMs }`    | `rotationEndTime + durationMs / 1000`    |
| `{ kind: "absolute", endTimeMs }` | `max(rotationEndTime, endTimeMs / 1000)` |

Durations and absolute endpoints must be non-negative and finite. An absolute endpoint more than `EPSILON` before the
rotation end is rejected. A tail is applied once; recurring work inside the tail does not recursively extend it.

The runtime drains the shared heap through the inclusive horizon. Work exactly at that instant is eligible; work one
microsecond later remains pending and does not change state. Tail work never extends rotation duration.

## 6. Shared queue ordering

The ordering key is `(canonical timestamp, phase, priority, causal placement, insertion sequence)`. Emission assigns
monotone `eventOrder` identities; derived packets inherit their cause's placement. Stable insertion order breaks ties.
Explicit causal metadata overrides inherited placement. There is no stream handoff or replay.

## 7. Event phases and combat boundaries

| Phase    | Value | Work                                                               |
| -------- | ----: | ------------------------------------------------------------------ |
| Sample   |     0 | Condition-rate sampling                                            |
| Settle   |     1 | Condition payouts and same-time non-damage reactions               |
| Ordinary |     2 | Cast completions, tasks, actions, strikes, and other state changes |

Phase outranks priority. The queue rejects past work and same-time phase rewinds; future work starts in its normal
phase. A new command starts a fresh causal root after due work settles. Fields and finishers settle before their owning
hit samples modifiers. Reactions enqueue follow-up work rather than recursively executing it.

Explicit Combat Start gates target damage and conditions, including precombat carryover. Self buffs, combo finishers,
auras, and eligible relic effects may execute before the marker. Inherited prefix boundaries remain pending until their
marker executes. Control-use notifications remain observable while their target effects are gated.

Target death freezes the combat projection after the lethal timestamp finishes. Sibling packets with the lethal
activation identity and the simultaneous condition-tick batch finish; distinct later attacks and hit-dependent grants
are suppressed. Authored command continuation still advances resources, cooldowns, and self state to the planning
boundary. Both snapshots are detached observations of this one state, not resumable checkpoints.

DPS starts at the first surviving positive player-damage event. Explicit Combat Start supplies the damage-free fallback
and precombat gate, not the condition pulse phase:

`dpsWindow = max(0, (deathTime ?? observationEndTime) - (firstHitTime ?? combatStartFallback))`.

Player health is always full; target-health-dependent mechanics use actual target state.

## 8. Status and condition clocks

Timed status queries use exact canonical half-open windows:

```text
active(at) = startsAt <= at && at < expiresAt
```

A status is active at its application timestamp and inactive at its expiry timestamp. Standard boon durations are
rounded to whole milliseconds using half-even rounding after duration modifiers. Their actual expiry is then rounded up
to the next absolute 40 ms action-tick boundary.

Exact form, field, and delayed-attack timers instead store `canonicalTime(start + duration)`. A mechanic may explicitly
include its final timestamp: for example, a queued final tether pulse or Dragon Trigger charge. Such exceptions use an
exact inclusive comparison and the mechanic's event ordering, never an epsilon extension.

Conditions use a shared clock relative to first positive player damage (`origin`), matching DPS and Kill Time:

- the next payout for a condition applied at `t` is at `origin + floor(t - origin) + 1`;
- one owner/condition group shares a wake and is rounded as one damage packet;
- condition rates are sampled at whole-second boundaries and at exact off-grid expirations;
- an off-grid expiry remainder is buffered and paid at the group's next whole-second wake;
- applications are semantically active through `[appliedAt, naturalExpiresAt)`;
- the observation horizon clips scheduled damage but does not change the application's natural semantic expiry;
- ambient target conditions use the same first-damage phase;
- before first damage, provisional encounter-second pulses allow a condition-only opener to start the clock;
- an off-grid direct opener replaces provisional wakes and discards pre-fight accrual; application expiry is unchanged;
- explicit Combat Start gates damage but does not set the tick phase.

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

- More than 100,000 normalized commands is rejected.
- The runtime loop and same-time queue chains have action safety limits.
- Unknown internal handlers, unserializable payloads, past work, and same-time phase rewinds throw.

Stable insertion ordering and queue-local causal inheritance keep independent simulations deterministic. Stochastic
combat choices are a separate seeded-randomness concern and do not alter the clock contract.

## Source of truth

- [Clock primitives](../../js/kernel/core/clock.ts)
- [Stable event queue](../../js/kernel/events/queue.ts)
- [Observation policy](../../js/kernel/execution/observation.ts)
- [Unified runtime](../../js/games/gw2/platform/simulation/runtime.ts)
- [Internal work](../../js/games/gw2/platform/simulation/internal-work.ts)
- [Effect materialization](../../js/games/gw2/platform/engine/effects/materializer.ts)
- [Condition resolution](../../js/games/gw2/platform/resolver/condition-resolution.ts)
- [GW2 timing helpers](../../js/games/gw2/platform/skills/timing.ts)
