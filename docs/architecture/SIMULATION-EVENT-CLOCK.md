# Simulation event clock specification

The engine uses a deterministic logical clock, advancing directly to the next work or boundary rather than in fixed-size
steps. This document owns exact time, readiness, expiry, and observation semantics. See
[event ordering](./SKILL-EVENT-ORDERING.md) for priority authoring and
[programmatic simulation](./PROGRAMMATIC-SIMULATION.md) for command/configuration shapes.

## Contract summary

| Property            | Contract                                                                   |
| ------------------- | -------------------------------------------------------------------------- |
| Internal time       | Seconds, canonicalized to one microsecond                                  |
| Authored units      | `*Ms` fields use milliseconds; cooldown/effect durations use seconds       |
| Resolution horizon  | Inclusive: work at the endpoint executes                                   |
| Status lifetime     | Half-open: `[startsAt, expiresAt)`                                         |
| Queue order         | Timestamp, phase, ascending priority, causal placement, insertion sequence |
| Default observation | Through rotation end                                                       |

## 1. Canonical time

```text
timeKey(seconds)      = round(seconds * 1,000,000)
canonicalTime(seconds) = timeKey(seconds) / 1,000,000
```

Inputs must be finite and `timeKey` a safe integer. Arithmetic aliases such as `0.56 + 0.04` and `0.6` share one
instant; `0.600001` remains distinct. Platform packet timestamps must also be non-negative.

Canonicalize calculated deadlines before comparing them. Use exact canonical comparisons without grace windows; elapsed
interval counts use integer keys. Recurring intervals must span at least one canonical microsecond. Resource amounts use
their own arithmetic policy, never clock tolerance.

### The 40 ms GW2 action tick

All rotation casts are accepted on absolute 40 ms ticks, including instant/independent casts, concurrent inputs, and
casts following off-grid waits or resource wakes. Completion and interruption reservations round up to an action tick,
with interruption capped by full completion. Positive action durations round up where required; imported observed action
timing may round to the nearest tick. Independent summon Quickness conversion uses a 1.5 rate and tick rounding unless
an explicit measured duration exists. Player durations already include permanent Quickness.

Temporary-effect expiry rounds up to an absolute action tick where its owner requires it. Exact mechanic timers and
authored packet offsets retain microsecond precision; the queue itself never applies an action grid.

## 2. Runtime advancement

One cursor, heap, profession/target state, resource controller, and RNG own the run. Score and detailed modes share
execution. Time advances to the earliest queued work, readiness boundary, or observation endpoint. Continuous resources
and cooldowns settle before discrete work; due work drains before another command is accepted.

Tasks share the packet heap and carry detached serializable data. Owner generations cancel obsolete lifetimes;
activation attribution alone does not cancel committed projectiles. Only executed facts become gameplay history.

## 3. Rotation commands and cast lanes

Malformed commands stop the run. Unknown or permanently unavailable skills produce invalid steps and warnings.

- Ordinary player casts use the serial lane.
- Instant skills can overlap when permitted, but preserve command order and wait for the actual interruption point.
- Independent actors use their own serial lane unless overlap is explicitly allowed.
- Waits and the final rotation boundary remain behind every outstanding reservation on every lane.

`concurrentOffsetMs` is relative to the preceding player cast's start. A requested instant that has passed moves to the
current clock for instant/independent actions; work is never backdated. A wait starts after the live clock, serial lane,
and outstanding reservations have converged, then adds `durationMs / 1000`.

### Cast timestamps

```text
start        = first absolute action tick allowed by lanes, input recovery, cooldowns, resources, and profession rules
fullEnd      = gw2CooldownReadyAt(start + effectiveCastDurationSeconds)
effectiveEnd = fullEnd, or min(fullEnd, gw2CooldownReadyAt(start + interruptAfterMs / 1000))
```

Shared and profession rules may modify authored duration. Metadata may retain the lane through `fullEnd` after a
committed interruption; otherwise it releases at `effectiveEnd`. The action occurs at `start`, and completion work runs
at `effectiveEnd`.

### Effect packet timestamps

Effects use `castStart` or `castEnd` as their origin; `castEnd` means `fullEnd` even for interruptions and is the
default. Without offsets or ticks, effects occur there. Packet times add `atMs / 1000`; repeated applications add
`(applicationIndex - 1) * intervalMs / 1000`. Explicit ticks supply individual offsets; aggregate hits share a
timestamp. Cast-scaled offsets follow runtime duration, while fixed offsets retain elapsed time.

Interruption filtering follows materialization. Per-packet channels retain packets through `effectiveEnd` inclusively;
commit-mode effects follow their commit cutoff and persistence metadata.

### Resource and proc lifecycle

Resource mutation settles elapsed work at the old rate before changing value, capacity, or rate. Readiness/depletion
wakes carry generations so stale work cannot mutate replacement lifetimes. Spending or expiry does not replay grants.

Eligibility precedes critical draws and proc claims. One hit's critical outcome is shared by eligible traits/equipment;
separate proc chances use their own seeded streams and strict ICDs. Derived strikes with different sources own separate
activations/weapon-strength rolls; related condition/control packets retain attribution. Recharge entitlements are
reserved once for accepted commit-eligible casts; rejection or pre-commit cancellation leaves them available.

### Cooldown and ammo timestamps

Recharge uses ordinary cooldown or ammo-recharge metadata plus shared/profession rules. The default anchor is
`effectiveEnd`; `rechargeAnchor: 'castStart'` selects `start`. Negative offsets are clamped at cast start:

```text
baseRechargeStart = selectedAnchor + rechargeOffsetMs / 1000
rechargeStart     = max(start, professionModifiedRechargeStart)
ordinaryReadyAt   = rechargeStart + rechargeDuration
```

Cooldown/ammo state commits in the completion task, even if its computed anchor is earlier. Player Alacrity is
permanent; summon recharge integrates received Alacrity windows. Explicit exemptions keep the base rate. Ammo recharge
and between-cast lockout are independent deadlines; readiness uses the later applicable boundary.

Retryable availability rounds a future retry to the next absolute action tick. The clock advances to that tick or an
earlier state-changing task and checks again. Cost admission uses exact readiness deadlines and the resource owner's
amount tolerance. A permanent denial records an invalid zero-duration step.

Ordinary cooldowns use canonical readiness. An armed internal proc cooldown is still blocked exactly at `readyAt`,
becoming ready only later. Its `readyAt = 0` sentinel means never armed and is ready at time zero.

## 4. Rotation end and observation end

`rotationEndTime` is the canonical maximum of live time, the serial lane, and outstanding reservations, including final
input recovery. Delayed damage alone does not extend it.

Observation defaults to rotation end. A tail adds its duration once; an absolute policy supplies an endpoint that must
not precede canonical rotation end. Durations/endpoints must be finite and non-negative. Arithmetic values rounding to
the same microsecond represent the same endpoint.

The heap drains through that endpoint inclusively. Work one microsecond later remains pending and cannot affect the
observation. Recurring tail work never recursively extends rotation or observation duration. Policy shapes are in
[observation boundaries](./PROGRAMMATIC-SIMULATION.md#observation-boundaries).

## 5. Shared queue ordering

The key is `(canonical timestamp, phase, priority, causal placement, insertion sequence)`. Emission assigns monotone
`eventOrder` identities; derived work inherits causal placement unless explicitly supplied. Stable insertion breaks
ties. There is no stream handoff or replay. See [event ordering](./SKILL-EVENT-ORDERING.md) for authoring examples.

## 6. Event phases and cleanup

| Phase    | Value | Work                                                               |
| -------- | ----: | ------------------------------------------------------------------ |
| Sample   |     0 | Condition-rate sampling                                            |
| Settle   |     1 | Condition payouts and same-time non-damage reactions               |
| Ordinary |     2 | Cast completions, tasks, actions, strikes, and other state changes |

Phase outranks priority. Past work and same-time phase rewinds are rejected; future work receives its normal phase.
Commands start fresh causal roots after due work settles. Fields and finishers settle before their hit samples
modifiers; reactions enqueue follow-up work rather than recursively resolving it.

Flip retirement always uses Ordinary, including zero-duration grants armed during settlement. Its reserved
`Number.MAX_VALUE` priority puts cleanup after queued gameplay and its same-time consequences, before rotation commands
at that deadline. Work created by those commands runs afterward. Readiness and visibility close at the deadline
independently of deletion; identity checks protect replacements. Other work cannot use the reserved priority.

## 7. Combat boundaries

Explicit Combat Start gates target damage and conditions, including precombat carryover. Self buffs, combo finishers,
auras, and eligible relic effects may execute beforehand. Inherited prefix boundaries remain pending until their marker
executes. Control-use notifications remain observable even when target effects are gated.

Target death freezes combat output after the lethal timestamp finishes. Sibling packets from the lethal activation and
the simultaneous condition batch finish; distinct later attacks and hit-dependent grants are suppressed. Commands still
advance resources, cooldowns, and self state to the planning boundary. Both snapshots are detached observations, not
checkpoints.

DPS starts at first surviving positive player damage. Explicit Combat Start provides the damage-free fallback and gate,
not the condition phase:

```text
dpsWindow = max(0, (deathTime ?? observationEndTime) - (firstHitTime ?? combatStartFallback))
```

Player health is fixed at full; target-health mechanics use live target state.

## 8. Status and condition clocks

Statuses are active exactly when `startsAt <= at && at < expiresAt`. Standard boon durations round to whole milliseconds
with half-even rounding after modifiers, then expiry rounds up to the next absolute 40 ms tick. Exact form, field, and
delayed-attack timers instead store `canonicalTime(start + duration)`. A mechanic may explicitly include a final pulse
or charge timestamp through exact comparisons and queue ordering, never an epsilon extension.

Conditions use a shared clock anchored to first positive player damage. Sample precedes Settle so owners see coherent
target state before payouts change health. Off-grid expiry buffering, provisional pre-damage wakes, attribution, and
rounding belong to [Shared condition ticks](./SHARED-CONDITION-TICKS.md). Observation clipping must not change a
condition's natural semantic expiry.

## Safety and determinism

The engine throws on runaway or invalid work instead of silently truncating it. Limits include 100,000 normalized
commands and bounded runtime iterations/same-time dequeues. Effect expansion has a cumulative 100,000-record budget:
each packet, announcement, or condition stack (including a fractional stack) costs one. Profiles reserve packets before
materialization; conditions reserve stacks before insertion/reactions. Filtering and cancellation do not refund budget.

Hit/repetition counts must be positive safe integers at most 100,000. Effect lists and tick arrays are bounded before
traversal/copying; standalone materialization enforces the same batch ceiling. Unknown handlers, unserializable
payloads, past work, and phase rewinds fail. Stable insertion and queue-local causality keep runs deterministic
independently of seeded combat randomness.

Implementation owners: [clock](../../js/kernel/core/clock.ts), [queue](../../js/kernel/events/queue.ts),
[observation](../../js/kernel/execution/observation.ts),
[coordinator](../../js/games/gw2/platform/simulation/coordinator.ts),
[cast timing](../../js/games/gw2/platform/execution/cast-timing.ts), and
[materialization](../../js/games/gw2/platform/effects/materializer.ts).
