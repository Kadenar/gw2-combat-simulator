# Epsilon and 40 ms timing audit

Date: 2026-09-14

## Verdict

Do not replace every `EPSILON` use with 40 ms quantization. The remaining uses fall into distinct categories:

- Floating-point comparison tolerances are intentional and should remain tolerances.
- `Number.EPSILON` uses are arithmetic guards and are unrelated to the simulation clock.
- Endurance recovery is continuous today. If regenerated endurance is intended to become spendable only on the GW2
  action tick, its predicted ready time should be rounded up in the shared endurance helper.
- Events and tasks scheduled at `time + EPSILON` or `time + 2 * EPSILON` are legacy ordering hacks. They should be
  refactored to use the real timestamp plus task priority, event priority, causal ordering, or an explicit state rule.
- Temporary-effect and status-window checks that add or subtract epsilon conflict with the documented exact, half-open
  lifetime contract. Actual tick-aligned effects should use `gw2EffectExpiresAt`; queries should use `isTimeInWindow` or
  exact canonical comparisons.

The 40 ms action tick is a mechanic-specific rule, not the global simulation clock. Refactoring synthetic epsilon
offsets does not automatically mean delaying those effects to the next 40 ms tick.

## Scope and validation

The audit found 478 textual `epsilon`/`EPSILON` matches across 160 TypeScript and JavaScript source files. Most are
imports, context plumbing, type declarations, or ordinary comparisons rather than timeline mutations.

Validation performed:

- `npm run build:modules`: passed.
- Focused Node tests for Warrior and Thief timing: 182 passed, 0 failed.
- Warrior and Thief saved-preset smoke tests: 2 passed, 0 failed.

The initial passing tests confirmed pre-cleanup behavior; several explicitly locked in the epsilon offsets identified
below and were updated with the Mesmer cleanup.

Follow-up: the Mesmer synthetic offsets identified in this audit have now been removed. Their focused suite passes with
exact timestamps and explicit same-time ordering.

Follow-up: the Warrior and Thief offsets described below have also been removed. Shared combo and sigil behavior has
only been inspected and remains unchanged.

## Classification

| Usage                                               | Verdict                            | Reason                                                                                                                                                           |
| --------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cast completion and interruption comparisons        | Keep                               | Tolerates arithmetic residue at authored packet and commit boundaries. It does not change event time.                                                            |
| Ordinary cooldown and ammo readiness comparisons    | Keep                               | Matches the documented readiness contract.                                                                                                                       |
| Recurring-loop and interval threshold comparisons   | Usually keep                       | Avoids losing a boundary iteration to floating-point residue. Canonicalizing generated timestamps may later reduce these uses, but 40 ms is not the replacement. |
| `Number.EPSILON` division and zero guards           | Keep                               | Machine epsilon is not the engine's 100-microsecond tolerance.                                                                                                   |
| Endurance amount comparisons                        | Keep                               | Prevents a nominally full resource from failing an affordability check due to residue.                                                                           |
| Endurance ready timestamps                          | Decide and likely refactor         | The shared helper returns fractional timestamps, unlike action-ticked Revenant energy.                                                                           |
| Emitted event or scheduled task at `time + EPSILON` | Refactor                           | Creates a false 0.1 ms or 0.2 ms gameplay timestamp to express ordering.                                                                                         |
| Duration or expiry extended by epsilon              | Refactor                           | Changes semantic lifetime and conflicts with exact half-open status windows.                                                                                     |
| Status queried at `time +/- EPSILON`                | Refactor where it changes lifetime | Causes early expiry, late expiry, or an artificial same-time exclusion.                                                                                          |
| Combo `inclusiveExpiry` implemented with epsilon    | Refactor                           | Inclusivity should be explicit or handled by same-time ordering, not by manufacturing duration.                                                                  |
| Sigil ICD check using `at + EPSILON`                | Clarify and refactor               | It contradicts the shared strict internal-cooldown boundary contract.                                                                                            |

## Endurance

### Current behavior

[`enduranceReadyAt`](../js/games/gw2/platform/combat/resources/endurance.ts) returns:

```text
at + missingEndurance / regenerationPerSecond
```

The epsilon parameter only treats a tiny missing amount as already affordable. It does not place readiness on the 40 ms
action grid.

The shared path is used by Elementalist, Engineer, Ranger, Revenant, Thief, and Warrior. Mirage also calls the lower
level helper directly. Existing tests intentionally assert fractional readiness, including `2 + 10 / 7.5`.

By contrast, [`revenantEnergyReadyAt`](../js/games/gw2/professions/revenant/core/mechanics/energy.ts) rounds the
absolute energy threshold up through `quantizeGw2ActionDurationUp` and explicitly describes the result as action-ticked.

### Recommendation

If regenerated endurance is spendable only on action ticks, refactor the shared readiness result once:

1. Keep endurance accumulation continuous so Vigor windows, grants, caps, and end-state values remain accurate.
2. Round only the first affordable retry timestamp up to the absolute 40 ms grid.
3. Recheck affordability after the scheduler advances to that timestamp.
4. Update focused endurance scheduling tests. Do not add tests for Quickness cast times or `interruptCommitMs`.

This is a real policy decision rather than an epsilon cleanup. The current continuous behavior was deliberately added
and is covered by tests, but it is inconsistent with an action-ticked resource-spend policy.

## Confirmed synthetic timeline offsets

These sites create observable timestamps solely to force "after" ordering.

### Mesmer (resolved)

- Illusionary Membrane now emits at shatter time and uses event priority for post-shatter ordering:
  [`chaos.ts`](../js/games/gw2/professions/mesmer/core/traits/chaos.ts).
- Fencer's Finesse now emits each stack at its hit time with post-hit priority:
  [`dueling.ts`](../js/games/gw2/professions/mesmer/core/traits/dueling.ts).
- Compounding Power now keeps simultaneous stacks at one timestamp:
  [`illusions.ts`](../js/games/gw2/professions/mesmer/core/traits/illusions.ts).
- Phantasm conversion tasks and displayed conversion timestamps now use the real conversion time:
  [`phantasms.ts`](../js/games/gw2/professions/mesmer/core/mechanics/illusions/phantasms.ts).
- Inspiring Imagery now ends its field exactly at detonation and explicitly permits its bound blast at that boundary:
  [`rifle.ts`](../js/games/gw2/professions/mesmer/core/mechanics/rifle.ts).
- Time Bomb now retains its authored duration and relies on the shared temporary-effect clock:
  [`time-bomb.ts`](../js/games/gw2/professions/mesmer/specializations/chronomancer/mechanics/time-bomb.ts).
- Phantom Pain now emits at shatter time with post-shatter priority:
  [`cloak-and-ambushes.ts`](../js/games/gw2/professions/mesmer/specializations/mirage/mechanics/cloak-and-ambushes.ts).
- Harmonize now queues its resource at full cast end:
  [`instrument-rules.ts`](../js/games/gw2/professions/mesmer/specializations/troubadour/mechanics/instrument-rules.ts).
- Instrument state and Tale resources now use their real timestamps; Altered Chord uses event priority:
  [`instruments.ts`](../js/games/gw2/professions/mesmer/specializations/troubadour/mechanics/instruments.ts) and
  [`tales.ts`](../js/games/gw2/professions/mesmer/specializations/troubadour/mechanics/tales.ts).
- Deadly Blades now uses post-shatter priority and Infinite Forge queues at Bladesong completion:
  [`deadly-blades.ts`](../js/games/gw2/professions/mesmer/specializations/virtuoso/traits/deadly-blades.ts) and
  [`shatters.ts`](../js/games/gw2/professions/mesmer/specializations/virtuoso/traits/shatters.ts).

The cleanup retains each trigger timestamp. Resolver priority handles buff-after-hit behavior, scheduler task order
handles resources, and simultaneous stacks share one timestamp unless the mechanic has a real measured delay.

### Warrior (resolved)

- Signet Mastery and Lesser Signet of Might now use their exact cast-completion or strike timestamp, with post-hit
  priority where required: [`arms.ts`](../js/games/gw2/professions/warrior/core/traits/arms.ts).
- Burst Mastery Swiftness now uses cast completion with post-packet priority:
  [`discipline.ts`](../js/games/gw2/professions/warrior/core/traits/discipline.ts).
- Berserker's Power now uses the triggering hit or Bladesworn completion timestamp with post-hit priority:
  [`strength.ts`](../js/games/gw2/professions/warrior/core/traits/strength.ts) and
  [`bladesworn/traits/index.ts`](../js/games/gw2/professions/warrior/specializations/bladesworn/traits/index.ts).
- All six Paragon state projections now use their actual transition timestamp:
  [`chants-and-commands.ts`](../js/games/gw2/professions/warrior/specializations/paragon/mechanics/chants-and-commands.ts).

These were ordering concerns, not 40 ms delays. Exact timestamps plus event priority now express the required order.

### Thief (resolved)

[`observeStealthBreakingStrike`](../js/games/gw2/professions/thief/core/mechanics/stealth.ts) schedules stealth loss at
the exact strike timestamp with explicit task priority. Its state snapshot uses the same timestamp and post-action event
priority. Cast availability explicitly permits one same-time stealth attack to claim the consumed stealth window.

No Quarter now queries Fury at the exact hit timestamp, preserving the canonical half-open expiration boundary:
[`critical-strikes.ts`](../js/games/gw2/professions/thief/core/traits/critical-strikes.ts).

### Shared combo and sigil logic (not implemented)

[`combo-materializer.ts`](../js/games/gw2/platform/scheduler/combo-materializer.ts) implements an inclusive combo-field
expiry by adding two epsilon to `expiresAt`. Both scheduler and resolver field selectors also shrink or widen field
windows with epsilon. This should become an explicit boundary rule backed by same-time ordering.

[`proc-events.ts`](../js/games/gw2/platform/equipment/sigils/proc-events.ts) calls the strict shared ICD helper with
`at + EPSILON`, which makes sigils ready at their exact boundary. Either sigils intentionally differ from every other
internal cooldown, in which case the exception should be named and tested directly, or the wrapper should be removed.

These shared paths were inspected only. The audited cleanup is not implemented; their current epsilon-based behavior
remains unchanged.

## Status lifetime inconsistencies

The canonical clock contract defines status windows as exactly half-open:

```text
startsAt <= at && at < expiresAt
```

However, several profession mechanics query an `Until` or `expiresAt` field at `at + EPSILON`, `at - EPSILON`, or
`expiresAt - EPSILON`. This can change status by 0.1 ms rather than merely tolerate floating-point residue.

Representative affected groups include:

- Mesmer flips, ambush windows, Mirage Mirrors, instruments, Mimic, and state snapshots.
- Guardian virtues, Luminary stances and auras, spear illumination, Firebrand Ashes, and flip windows.
- Elementalist elemental lifetimes, Elemental Balance, Perfect Weave, Rock Barrier, and Shattering Ice.
- Warrior fire aura, Positive Flow, Tactical Reload, and Dragon Trigger deadlines.
- Ranger ambush, Natural Mender, Mistral, and pet busy windows.
- Revenant Reaver's Curse and upkeep/internal readiness checks.
- Necromancer shroud, minion control windows, Painful Bond, and signet timing.
- Thief artifact expiry tasks. No Quarter's Fury lookup is resolved above.

Not every field in that list should be put on a 40 ms grid. The refactor should classify each field first:

- Actual temporary effects: calculate the deadline with `gw2EffectExpiresAt`.
- Cooldowns and resource readiness: retain their own mechanic-specific policy.
- Exact availability or status windows: canonicalize endpoints and query them without epsilon.
- Same-time cause/effect ordering: use queue ordering metadata.

The No Quarter regression demonstrated this bug: a Fury stack ending at `1.0` was treated as expired at `0.99995`
because the query was moved forward by epsilon. The query and test now follow canonical microsecond precision and the
documented half-open rule.

## Uses that should remain

The following groups are not missed 40 ms migrations:

- Scheduler checks for completed versus interrupted casts and per-packet interruption cutoffs.
- Cooldown, ammo, cast-lane, lockout, and retry readiness comparisons.
- Observation-policy validation allowing insignificant numeric residue in a supplied endpoint.
- Resource amount comparisons such as endurance, initiative, adrenaline, energy, heat, and charge thresholds.
- Fractional proc accumulators, interval floor/ceil arithmetic, and recurring-task horizon loops.
- `Number.EPSILON` guards used to prevent division by zero or discard numerically empty contributions.
- The `1e-9` correction inside `quantizeGw2ActionDurationUp`, which prevents an exact action-tick boundary from being
  rounded into the following tick.

Some recurring loops could later canonicalize each computed timestamp and use exact comparisons. That would be a numeric
cleanup, not a conversion to a 40 ms simulation clock, and should only be done where a focused boundary test shows
value.

## Documentation conflicts

[`SIMULATION-EVENT-CLOCK.md`](architecture/SIMULATION-EVENT-CLOCK.md) and current boon code state that temporary-effect
expiry is rounded up to the next absolute 40 ms boundary.

[`SKILL-EVENT-ORDERING.md`](architecture/SKILL-EVENT-ORDERING.md) still says boon and condition expiration is
application time plus duration without further snapping.
[`SHARED-CONDITION-TICKS.md`](architecture/SHARED-CONDITION-TICKS.md) correctly preserves exact natural condition
expiration, but its opening wording groups boons and conditions together.

The documentation should distinguish:

- standard boon expiry: next absolute 40 ms boundary;
- condition natural expiry and sampling: exact canonical timestamp;
- generic profession effects: use their explicitly selected mechanic policy.

## Recommended refactor order

1. Remove real timestamp and duration mutations based on epsilon. Replace them with task priority, event priority,
   causal ordering, or exact state transitions.
2. Update tests that assert `0.0001` and `0.0002` delays to assert the required same-time ordering contract instead.
3. Migrate actual temporary-effect state deadlines and queries to `gw2EffectExpiresAt` and `isTimeInWindow`.
4. Decide whether regenerated endurance is action-ticked. If yes, change the shared ready-time calculation without
   discretizing stored endurance.
5. Resolve the documentation contradiction.

Warrior and Thief source behavior was updated as described above. Shared combo and sigil behavior remains follow-up
work.
