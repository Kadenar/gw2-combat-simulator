# Status lifetime remediation plan

Date: 2026-09-14

Source: [`EPSILON-TIMING-AUDIT.md`](EPSILON-TIMING-AUDIT.md)

## Objective

Make every profession status lifetime follow one declared timing policy without changing unrelated cooldown, cast,
resource, or scheduling behavior.

The target contract for a status window is half-open:

```text
startsAt <= at && at < expiresAt
```

An effect is active at its start and inactive exactly at its expiry. Epsilon must not extend, shorten, or shift that
window.

## Existing primitives

Reuse the timing utilities already in the repository:

- [`canonicalTime`](../js/kernel/core/clock.ts) normalizes exact simulation timestamps.
- [`isTimeInWindow`](../js/kernel/core/clock.ts) implements canonical half-open window checks.
- [`gw2EffectExpiresAt`](../js/games/gw2/platform/skills/timing.ts) computes the next absolute 40 ms expiry for effects
  governed by the GW2 temporary-effect clock.

Do not add another status-window abstraction unless an identified case cannot use these functions.

## Classification rules

Classify every candidate before editing it. A field name ending in `Until` or `ExpiresAt` is not enough to determine its
policy.

| Category                          | Deadline creation                                  | Query rule                                      |
| --------------------------------- | -------------------------------------------------- | ----------------------------------------------- |
| Tick-aligned temporary effect     | `gw2EffectExpiresAt(start, duration)`               | `isTimeInWindow` or exact half-open comparison  |
| Exact mechanic/availability window | `canonicalTime(start + duration)`                  | `isTimeInWindow` or exact half-open comparison  |
| Actor or form lifetime            | `canonicalTime(start + duration)`                  | Explicit exact boundary and queue ordering      |
| Cooldown or resource readiness    | Existing mechanic-specific calculation             | Keep documented readiness tolerance             |
| Cast, packet, or interrupt boundary | Existing cast calculation                         | Keep arithmetic-residue tolerance               |
| Same-time cause/effect ordering   | Real timestamp                                     | Task priority, event priority, or causal ordering |

For cleanup while advancing state to `target`, an expired half-open window should normally be cleared with
`expiresAt <= target`. Cleanup is different from asking whether an effect is active at a timestamp.

## Per-field investigation checklist

Trace the complete lifecycle before changing a field:

1. Find every write to its start and expiry timestamps.
2. Find every scheduler, resolver, availability, snapshot, and presentation query.
3. Identify any emitted buff, condition, task, or expiry event representing the same effect.
4. Select one timing category from the table above.
5. Compute the deadline once using that category's helper and reuse it everywhere.
6. Decide how refreshes, extensions, consumption, and same-time events behave.
7. Add the smallest focused boundary test before moving to the next mechanic.

Do not mechanically replace all `EPSILON` comparisons. The audit's search results include legitimate readiness,
resource, cast, recurring-loop, and stale-task comparisons.

## Implementation plan

Each batch should include its source changes and focused tests. Keep batches separated by timing semantics so a review
does not have to distinguish temporary-effect snapping from exact actor or mechanic deadlines in the same change.

### 1. Fix known shifted status queries

- Query Bladesworn Fury at the exact `castStart` in
  [`gunsaber-and-trigger.ts`](../js/games/gw2/professions/warrior/specializations/bladesworn/mechanics/gunsaber-and-trigger.ts).
- Search for other status APIs receiving `at + epsilon`, `at - epsilon`, `startsAt + epsilon`, or equivalent expressions.
- Preserve epsilon in resource, cast, cooldown, and retry calculations found by the same search.

Exit condition: shared boon and condition queries receive the actual gameplay timestamp.

### 2. Migrate tick-aligned temporary effects

For each confirmed temporary effect:

- Replace raw `at + duration` state deadlines with `gw2EffectExpiresAt(at, duration)`.
- Store and schedule the same computed expiry rather than calculating parallel deadlines.
- Replace shifted comparisons with exact half-open queries.
- Make refresh and duration-extension behavior use the same clock policy.

Initial high-confidence candidates:

- Guardian: Firebrand Ashes, Willbender virtue effects, Luminary effects, and spear illumination.
- Elementalist: Elemental Balance, Perfect Weave, Shattering Ice, and Elemental Empowerment stacks.
- Engineer: Holosmith Solar Focusing Lens.
- Warrior: Berserker fire aura, Positive Flow, and Tactical Reload.
- Revenant: Reaver's Curse.
- Necromancer: Painful Bond.

Exit condition: the profession state, emitted effect, expiry task, and presentation all share one expiry timestamp.

### 3. Normalize exact mechanic and availability windows

Canonicalize endpoints when they are written and remove epsilon from active/expired queries for:

- Mesmer flips, Mirage ambushes and Mirrors, Mimic, instrument windows, and state snapshots.
- Guardian flip and weapon-state windows.
- Elementalist elemental lifetimes and Rock Barrier.
- Ranger Untamed ambush availability.
- Necromancer form and control windows.

Availability should start exactly at `startsAt` and stop exactly at `expiresAt`. Scheduler cleanup and state snapshots
must apply the same rule.

Exit condition: the same timestamp cannot be active in the resolver and expired in availability or snapshot state.

### 4. Resolve explicit boundary-policy cases

The following mechanics cannot be safely migrated until their exact-expiry behavior is selected:

| Mechanic                    | Decision required                                                                 |
| --------------------------- | --------------------------------------------------------------------------------- |
| Chronomancer Time Bomb      | Tick-aligned temporary effect expiry or exact delayed-attack timer                |
| Dragon Trigger              | Whether a charge operation at the exact deadline is valid                         |
| Dragonhunter tether         | Whether a pulse at the break/expiry timestamp resolves before the state transition |
| Galeshot Mistral            | Whether a projectile task exactly at expiry is valid                              |
| Antiquary Skritt Scuffle    | Whether the final task exactly at actor expiry is valid                           |
| Necromancer minion control  | Whether a control packet exactly at the control deadline is valid                 |

Once decided, encode inclusivity with an exact comparison and same-time queue priority. Do not represent an inclusive
boundary by adding epsilon to the deadline.

Exit condition: each rule has one focused same-timestamp test and a short logic comment at the implementation site.

### 5. Reconcile documentation

Update the timing documentation to state separately that:

- standard boon expiry uses the next absolute 40 ms boundary;
- condition natural expiry uses its exact canonical timestamp;
- profession effects use their explicitly selected mechanic policy;
- status windows are half-open unless a named mechanic documents an exact inclusive boundary.

Relevant documents:

- [`SIMULATION-EVENT-CLOCK.md`](architecture/SIMULATION-EVENT-CLOCK.md)
- [`SKILL-EVENT-ORDERING.md`](architecture/SKILL-EVENT-ORDERING.md)
- [`SHARED-CONDITION-TICKS.md`](architecture/SHARED-CONDITION-TICKS.md)

## Test strategy

Use minimal mechanic scenarios rather than full saved rotations. For a normal half-open window, cover:

| Query time        | Expected state |
| ----------------- | -------------- |
| `startsAt - 1 us` | Inactive       |
| `startsAt`        | Active         |
| `expiresAt - 1 us` | Active        |
| `expiresAt`       | Inactive       |

Add refresh, extension, or consumption cases only where the mechanic supports them. For queued expiry behavior, test
the observable order of events sharing the same canonical timestamp instead of asserting a synthetic `0.0001` delay.

Tests must follow the repository testing policy:

- Cover lifecycle, state transition, scheduling, and event-ordering contracts.
- Do not add Quickness cast-time or `interruptCommitMs` tests.
- Do not add full-result snapshots or per-skill aggregate regression assertions.
- Saved-preset tests may verify load/simulation success and total DPS within the allowed 1% relative error.

## Validation per batch

1. Format only the touched files with Prettier.
2. Run the directly affected profession test files.
3. Run `npm run build:modules`.
4. Run `npm run typecheck` when state or public types change.
5. Run `npm run test:node` before merging the completed remediation.

## Completion criteria

The remediation is complete when:

- no status lifetime is queried at a timestamp shifted by epsilon;
- every temporary-effect deadline uses its declared tick-aligned or exact policy;
- producer, scheduler, resolver, availability, snapshot, and presentation paths agree at exact boundaries;
- intentional inclusive boundaries are named, exact, and covered by same-time ordering tests;
- remaining epsilon uses are classified as arithmetic tolerance, readiness, resource, cast, recurring-loop, or task
  identity behavior;
- the timing documentation no longer gives conflicting boon, condition, or profession-effect expiry rules.

## Out of scope

Handle these as separate policy changes rather than bundling them into status remediation:

- action-ticked versus continuous endurance readiness;
- shared combo-field inclusive expiry;
- the sigil internal-cooldown boundary rule;
- broad recurring-loop timestamp canonicalization.
