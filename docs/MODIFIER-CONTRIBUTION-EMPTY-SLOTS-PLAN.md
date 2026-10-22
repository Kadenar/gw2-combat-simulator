# Modifier contribution empty cast slots: implementation plan

Status: proposed. This document describes implementation work; it does not change simulation behavior.

## Objective

When removing a modifier makes a rotation skill unaffordable, consume the time that skill occupied in the successful
baseline without executing it. For example, disabling Firebrand's Weighty Terms can remove page refunds. A tome skill
that then lacks pages should occupy an empty cast slot instead of delaying the rotation until pages regenerate.

This prevents both resource-recovery stalls and the free time created by immediately deleting a cast. Normal simulations
retain their existing retry behavior.

## Behavioral contract

- Run the deterministic baseline normally and capture scheduling information for accepted cast commands.
- In a comparison, wait for ordinary cooldown, input, lane, and applicable profession readiness before checking whether
  an otherwise eligible command can afford its resource cost.
- If that command is unaffordable, reserve its baseline slot and consume the command. Do not wait for resource recovery.
  This applies whether recovery would eventually be possible or the resource gate has no future retry boundary.
- Do not reconsider the skipped command if resources recover during its empty slot. Evaluate later commands against the
  current resource state.
- Empty slots produce no cast events, damage, boons, resource spending, refunds, cooldowns, ammo consumption, cast
  hooks, chain progression, weapon swaps, or other gameplay transitions.
- Existing conditions, buffs, summons, resource recovery, and queued events continue through the ordinary scheduler.
- Preserve the original lane and concurrency relationships. Empty slots must not block unrelated overlapping actions.
- Preserve explicit waits, combat markers, and cooldown-reset commands.
- Keep genuine invalid-command diagnostics. Do not manufacture a slot for a command the baseline never accepted.

This policy preserves a skipped action's occupied duration at its comparison execution point. It does not replay every
command at a fixed baseline timestamp. Successful casts and their downstream effects still follow the comparison's live
state, so other changes to timing can shift the rotation.

## Implementation steps

### 1. Capture a minimal baseline scheduling trace

Add an opt-in trace at the point where `cast-execution.ts` has resolved cast timing and updates the rotation cursor.
Capture scheduling facts directly, rather than reconstructing them from rounded report rows.

Each entry should identify the original command index and resolved skill, and retain only the timing offsets and lane
properties needed to reproduce its scheduling footprint. Repeated uses of a skill must have distinct entries. Capture
actual resolved occupancy, including authored interruptions, rather than looking up nominal cast duration later.

The trace must work with score-only output and must not require chart histories, input observations, or detailed
reports. Freeze or detach entries before sharing them with comparisons. Validate indices, finite durations, and command
identity; reject malformed traces rather than guessing replacement timings.

Capture once per existing contribution batch and reuse across its comparisons. Each worker currently runs its own
baseline; retain that arrangement initially rather than adding another worker coordination phase.

### 2. Add an explicit execution policy

Carry the baseline trace and comparison policy through simulation options, runtime setup, and combat execution into the
rotation driver. These are transient execution inputs, not fields in saved builds or `Gw2Config`.

Use the same canonical option and trace representation in worker and synchronous execution. Normal runs omit the policy
and continue through the current retry path. Do not add legacy aliases, adapters, or compatibility fallback shapes.

### 3. Separate resource blocking from other readiness gates

The current readiness result is not enough to classify every failure safely. Profession composition can merge a resource
retry with another retry, retain the other gate's code, and select the later deadline. A string check on the final
reason or code could therefore miss a resource shortage or suppress a legitimate non-resource wait.

Refactor the canonical readiness evaluation to retain the distinction between resource affordability and other admission
gates. Share the underlying gate logic rather than maintaining a second copy for contributions. Do not call potentially
stateful readiness hooks twice for the same decision.

Apply this ordering:

1. Resolve the command and its applicable scheduling boundaries.
2. Reject permanently invalid non-resource states through the existing diagnostic path.
3. Honor non-resource retry boundaries and reevaluate when reached.
4. Evaluate affordability at the resulting cast opportunity.
5. Accept an affordable cast normally, or consume its baseline empty slot if unaffordable.

Keep unknown skills, invalid equipment, inactive tomes, and invalid chains distinct from resource shortages. Resource
policy should be generic across declared resources, with no Firebrand-specific branch in the driver.

### 4. Introduce scheduling-only slot consumption

Extract the scheduling bookkeeping in `RotationCursor.acceptCast` into an operation usable by both accepted casts and
empty slots. An empty slot advances the cursor, reserves the appropriate lane, and supplies the scheduling anchor used
by following concurrent commands.

Keep this scheduling anchor separate from facts that an actual cast occurred. For example, reserving a stunbreak's empty
slot must not clear a real self-stun, and reserving a swap's slot must not change weapons or fire swap hooks.

Do not route empty slots through cast acceptance, cancellation, completion, or gameplay reservations. Do not implement
them as authored `Wait` commands: waits join lanes and would alter concurrency. Do not advance the clock directly; let
the scheduler visit intervening queued work and resource boundaries normally.

Ensure an empty final slot contributes to the rotation endpoint even when no successful cast follows it. Instant and
independent slots must retain their own scheduling behavior without acquiring an artificial serial delay.

### 5. Integrate contribution preparation and diagnostics

Update `calculateContributionComparisons`, its worker, and the synchronous application adapter to capture and supply the
trace through the same execution path.

Keep original rotation command identities stable. For `Skill` comparisons, replace the current filtering of removed
skill commands with explicit suppression that consumes their baseline slots. This intentionally changes skill-removal
comparisons: removed casts lose their effects and resource rewards but retain their occupied time. Handle suppression
before the removed skill's build-availability denial, without relaxing equipment checks for other commands.

Record intentional empty slots as comparison diagnostics with command index, skill identity, and reason. Keep these
separate from genuine simulation warnings. Missing baseline slots must be reported explicitly; do not silently fall back
to nominal duration or resource retries. Baseline-invalid commands retain normal rejection behavior.

No new UI is required initially. Keep diagnostics available to focused tests and debugging without changing the public
contribution display.

### 6. Preserve current scoring semantics

Continue comparing the baseline and comparison DPS using the existing scoring rules. DPS begins at the first damaging
hit and can end at target death. Preserving an empty slot therefore does not guarantee an identical DPS denominator or
combat window across runs.

Do not force the baseline's absolute observation endpoint onto comparisons: successful actions may shift later, and the
current absolute observation policy rejects endpoints earlier than rotation completion. A fixed baseline replay and
common scoring window would require a separate design, including target-health and target-death semantics.

## Expected code touchpoints

| Area                       | Files                                                                                                                                 | Responsibility                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Contribution orchestration | `js/games/gw2/app/simulation/modifier-contributions/modifier-contributions.ts`, `worker.ts`, and `js/games/gw2/app/create-runtime.ts` | Baseline capture, trace reuse, removed-skill suppression, shared execution policy |
| Simulation entry           | `js/games/gw2/platform/simulation/options.ts`, `run-contract.ts`, `runtime.ts`, and `combat-execution.ts`                             | Carry transient execution inputs into the driver                                  |
| Execution                  | `js/games/gw2/platform/execution/cast-execution.ts`, `rotation-driver.ts`, `rotation-cursor.ts`, and `driver-contract.ts`             | Trace collection, readiness decisions, and scheduling-only slot consumption       |
| Readiness composition      | `js/games/gw2/platform/profession-definition/profession.ts` and `js/games/gw2/platform/execution/skill-cost.ts`                       | Preserve resource/non-resource gate distinctions without duplicate logic          |

Add dedicated types or modules where needed to keep scheduling records separate from gameplay casts and result views.
Include short functional comments explaining the intended behavior wherever functionality is introduced or changed.

## Validation

Use minimal Node scenarios to cover these contracts:

- Normal simulations retain resource retries; contribution comparisons consume an empty slot instead.
- An empty slot preserves serial progression, concurrency anchors, independent work, and final rotation completion.
- Queued work and regeneration execute during empty slots; later affordable commands succeed without retrying skipped
  commands.
- Empty slots leave resources, cooldowns, ammo, gameplay transitions, and cast-triggered effects untouched.
- Combined non-resource and resource blocking honors the non-resource wait before deciding affordability.
- Intentionally removed skills retain original command identity and scheduling space.
- Invalid baseline commands and malformed traces remain visible failures or diagnostics, without invented timing.
- An unchanged comparison reproduces baseline behavior, and worker and synchronous callers use equivalent policies.
- A minimal Firebrand scenario distinguishes Weighty Terms page refunds from the empty-slot behavior when it is
  disabled.

Test scheduling, resources, causal ordering, and state transitions. Do not add standalone native cast-time, Quickness,
interrupt-commit, retained-lockout, individual-hit timing, or packet-schedule calibration tests. Do not assert full
saved rotation shapes or exact benchmark DPS. Saved-preset smoke runs may check loading and successful simulation; any
numerical preset regression must use only total DPS within the repository's maximum 1% relative error.

After implementation, run focused affected Node tests, module build, type checking, and relevant lint checks. If worker
integration changes, run the existing relevant browser files. Obtain approval before adding any browser tests. Format
every touched supported file with Prettier, including this plan if edited, and do not format unrelated files.

## Completion criteria

- Missing pages in a contribution run consume baseline scheduling space without a page-regeneration stall.
- Skipped casts cannot trigger gameplay effects or accelerate the rotation by deleting their occupied slots.
- Normal simulations retain their current readiness behavior.
- Removed-skill comparisons and both execution entry points follow the same documented policy.
- Focused validation passes, intentional skips are distinguishable from errors, and scoring limitations remain explicit.
