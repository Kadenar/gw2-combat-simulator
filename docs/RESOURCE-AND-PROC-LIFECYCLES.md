# Shared resource and proc cooldown lifecycles

Status: resource migration implemented and validated, 2026-09-24. Proc cooldown management remains proposed and is
outside the current implementation.

This extends the ownership approach in [ENDURANCE-REFACTOR.md](ENDURANCE-REFACTOR.md). It covers regenerating and
draining resources and proc internal cooldowns. The two migrations can proceed independently.

## Objectives and boundaries

- The GW2 platform owns resource arithmetic, chronological mutations, recovery scheduling, affordability calculations,
  and depletion detection. Profession modules own eligibility, balance formulas, and consequences such as leaving
  shroud.
- Resource policies remain under module `resources`; mutable pools remain inside Core or specialization state. Do not
  add a top-level property for each resource beside profession or resolver state.
- The platform owns proc cooldown storage and claims, separately for scheduling and resolving. Professions and equipment
  own trigger eligibility, cooldown grouping, duration, and effects.
- Reuse existing primitives and task scheduling. Do not introduce another event queue, generic component framework,
  subscription system, or configuration language.
- Preserve the separation between planning predictions and resolved combat. A resolver mutation never changes scheduler
  resources, and a scheduler snapshot never resets resolver proc cooldowns.
- This does not expand player-health simulation, unify profession transformations, or replace skill cooldown/ammo
  recharge. It also does not require the broader family snapshot refactor.

## Existing foundations

Paths below are relative to `js/games/gw2/` unless stated otherwise.

| Existing implementation                         | Responsibility to retain                                                           |
| ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| `platform/combat/resources/pool.ts`             | Capped arithmetic.                                                                 |
| `platform/combat/resources/clock.ts`            | Continuous accrual, rate changes, zero crossings, and discrete cadence arithmetic. |
| `platform/execution/resource-clock.ts`          | Generation-safe depletion tasks, maximum lifetimes, and rescheduling.              |
| `platform/combat/resources/endurance-policy.ts` | Selected policy, pool access, initialization, grants, spending, and readiness.     |
| `platform/engine/effects/timed-effects.ts`      | Recurrence, replacement, expiry, and task ownership.                               |
| `platform/execution/scheduler-reactions.ts`     | Effects scheduled at their causal event's timestamp.                               |
| `platform/combat/procs.ts`                      | Claiming an internal cooldown before emitting effects.                             |
| `platform/combat/critical-procs.ts`             | Seeded critical outcomes, secondary proc rolls, and materialization.               |
| `js/kernel/core/clock.ts` (repository-relative) | Canonical microsecond timestamps and the shared ICD predicate.                     |

The remaining duplication is primarily coordination. Firebrand and Galeshot manually copy discrete-clock results into
their state. Specter and Druid coordinate clocks and depletion. Revenant maintains an Energy accrual segment and detects
starvation inside advancement. Necromancer maintains a separate future-gain timeline and combines drain, gains, pulses,
and exits inside its Life Force loop.

Proc consolidation has already started: many traits call `tryConsumeProcCooldown`. Other consumers still compare and
assign individual deadlines. Sigils now share the strict boundary predicate; critical proc deadlines and charge grants
also contain cooldown state.

## 1. Regenerating and draining resources

### Declaration and state ownership

Extend the existing resource capability contract with continuous and discrete policies. A module supplies ordinary typed
objects; no new factory is required for policy declarations. Suggested placement:

```ts
// Illustrative declaration: the shared controller owns recovery and mutations of this specialization's pool.
resources: {
  tomePages: {
    kind: 'discrete',
    state: (context) => firebrandState.from(context).tomePages,
    maximum: pageCapacity,
    initial: initialPages,
    recovery: pageRecovery
  }
}
```

The example uses the implemented policy shape. `tomePages` becomes a resource state object in the owning specialization.
Update consumers together; do not retain a numeric alias beside it.

Each policy supplies:

| Field                           | Contract                                                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `kind`                          | `continuous` or `discrete`; avoid a single formula pretending they are equivalent.                                    |
| `state(context)`                | Selects the canonical mutable pool in Core or specialization state.                                                   |
| `maximum(context)`              | Derives capacity from the selected catalog/configuration and profession rules.                                        |
| `initial(context, maximum)`     | Supplies the starting amount; the platform validates and clamps it.                                                   |
| `recovery(context)`             | Continuous net rate, or a discrete amount, interval, and initial deadline. Zero rate/disabled recurrence is explicit. |
| Depletion behavior, when needed | Existing depletion declaration with a profession callback and optional maximum lifetime.                              |

Use the existing `ResourceClock` for continuous state. Its `maximum` and `rate` are platform-maintained snapshots of the
current accrual segment, not profession-maintained sources of tuning. Shared initialization fills these fields;
profession code must not also maintain `maximumEnergy`, `maximumLifeForce`, or similar aliases. Keeping the old
segment's tuning allows the platform to settle it before a cap or rate changes.

Discrete state needs the current value, settled timestamp, next authored deadline, and the active cadence/cap snapshot.
Use a small dedicated type. Cadence phase must survive reads, capped gains, and unrelated resource mutations.

Composition follows endurance: Core contributes resources, and the selected specialization can replace the policy for
the same resource key. Only one active policy owns a given pool. Different keys coexist. Family composition admits one
Core and one selected elite; initialization rejects different keys selecting the same mutable pool. No capability means
unsupported, not a synthetic empty pool.

### Shared operations

Implement the smallest scheduler-facing controller around the existing arithmetic. Proposed operations are:

| Operation           | Intended behavior                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Initialize          | Seed pools from the active catalog before profession gameplay hooks; support standalone previews through the same initialization. |
| Read/project        | Return the value at a time and derived capacity without changing the live anchor or running gameplay callbacks.                   |
| Advance             | Settle recovery through the scheduler's next boundary exactly once.                                                               |
| Grant               | Settle preceding recovery, then add a validated amount up to capacity.                                                            |
| Spend               | Settle preceding recovery, then pay a validated cost; insufficient funds fail without a partial payment.                          |
| Refresh recovery    | Settle the old segment, sample the new rules, and refresh affected recovery/depletion tasks.                                      |
| Query affordability | Return the next justified retry time, or `null` when no known recovery can fund the cost. Never mutate live state.                |

Register shared resource advancement once during runtime assembly. Remove each migrated resource's old advance hook;
mixed hooks keep only their unrelated work. Profession hooks call refresh at actual transitions such as changing upkeep,
entering a form, or changing a trait-dependent mode. Avoid polling every profession callback on every query.

Grants and spends execute at the scheduler clock. Future effects use existing owned tasks or completion hooks.
Hit-funded grants retain their event identity and cancellation/off-target checks. Cancellation of a cast must not cancel
a projectile that the engine has already committed to survive; use the same ownership rules as its causal effect.

Discrete recovery can batch arithmetic only across intervals with no intervening mutation or observable pulse effect. If
each pulse emits an effect or changes eligibility, use `timedEffect` and the shared grant operation. No general event
log is needed for resource history.

### Timing, caps, and affordability

Follow the [simulation event clock](architecture/SIMULATION-EVENT-CLOCK.md): canonical microsecond ordering, with 40 ms
detection only where GW2 resource readiness or depletion already requires it. Do not round stored fractional resources.

1. Settle continuous recovery to the next scheduler boundary using the previous segment's rules.
2. Process mutations and depletion tasks in the engine's established priority and causal order.
3. Re-evaluate a depletion deadline when its task executes. A prior grant at that timestamp may invalidate it.
4. Run the profession's depletion consequence once for that resource lifetime, then refresh recovery if the consequence
   changes it. No repeated zero-time depletion tasks.

There is no universal rule that grants win every tie. Record and test each migrated mechanic's existing equal-time
ordering, particularly Necromancer's hit gains, passive pulses, and shroud exit. Any intentional ordering correction is
a separate behavior change, with its own minimal reproduction.

Capacity changes settle the old segment first, clamp against the new capacity, and refresh deadlines. Increasing
capacity does not refill a live pool. Changing a discrete interval must specify whether the mechanic preserves its
pending pulse or restarts cadence; document that rule in the migration rather than silently resetting on every query.

For continuous recovery, calculate affordability from the current segment and stop predictions at the next known rule
change. For discrete recovery, calculate the required number of pulses, preserving the authored cadence and tick
detection. Neither calculation may count an unexecuted conditional hit as a guaranteed grant.

The scheduler already retries at the earlier of a suggested time and its next task. When the current rate cannot fund a
cost but an already-scheduled relevant grant or rate transition can change that answer, return that boundary as a retry.
Track those boundaries through the existing resource-owned tasks, not a second gain timeline. If there is no recovery or
known relevant transition, return `null`; do not wake forever on unrelated recurring tasks. Costs above a fixed capacity
are impossible unless a known capacity transition can change that limit.

Validation rejects non-finite amounts/rates/caps, negative grants or costs, backwards mutations, and invalid enabled
cadences. Zero capacity may explicitly disable a pool; it must not create a depletion loop. Disabled recurrence has no
scheduled timestamp, rather than a zero interval passed to `advanceDiscreteResource`.

### Migration sequence

| Stage               | Consumers                                | Rules that stay local                                                                                                                                     |
| ------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1: discrete pilot   | Firebrand tome pages; Galeshot arrows    | Tome eligibility, Swift Scholar, costs/refunds, arrow gain sources, cadence start and cap behavior.                                                       |
| 2: continuous pilot | Thief initiative                         | Preparedness capacity, kneeling rate, skill costs and refunds. Signet pulses remain timed effects.                                                        |
| 3: draining forms   | Specter Shadow Force; Druid Astral Force | Entry gates, exit consequences, retention, maximum form duration, Natural Mender suppression/cadence. Reuse their existing depletion helper.              |
| 4: upkeep           | Revenant Energy                          | Precombat rules, legend-swap grants, upkeep selection, starvation consequences, and release/starvation recharge through the existing cooldown controller. |
| 5: mixed recovery   | Necromancer Life Force                   | Percentage gain conversion, Gluttony, shroud-specific drain, signet eligibility, and Eternal Life's partial refill threshold.                             |

For Necromancer, replace the gain timeline only after drain and pulse boundaries use scheduler-owned tasks. Replace its
custom loop as a complete resource migration; do not layer shared advancement on top of it.

Endurance remains supported by its current capability during the pilots. Once the common controller is proven, move its
scheduling integration onto that controller only if the same cancellation-aware Vigor interval behavior can be retained.
Keep the existing interval arithmetic; do not force Vigor into a single rate sampled once per long wait. Do not
introduce a compatibility facade solely to preserve obsolete endurance APIs.

### Presentation and replay

Resource meters, attribute previews, planning projections, and availability must use the selected policy and catalog.
Display values such as maximum capacity are derived reporting data. UI-only labels remain profession-owned.

Preserve useful public presentation fields through explicit projections, not duplicate mutable state. Scheduler
snapshots carry detached resource values needed for replay; they cannot overwrite independently consumed resolver
charges. A resolver-local resource operation uses its own state and timestamp and cannot invoke scheduler depletion
callbacks.

## 2. Proc cooldown management

### Shared claims and phase-local storage

Keep `tryConsumeProcCooldown` as the single non-critical claim operation. Move its backing store from profession
`traitProcReadyAt` objects and scalar fields into platform-owned proc runtime state. Use one registry per scheduler run
and a separate registry per resolver run. The scheduler's materializer uses the scheduler registry; it must not create a
third competing store for the same scheduler-owned proc.

Expose the registry through the phase context's proc operations. No per-proc property is added beside profession state,
and no new proc module registry is necessary merely to call the helper.

Use stable namespaced identities, such as `ranger.one-wolf-pack`, plus an explicit bucket where cooldowns are per actor,
recipient, target, or application. A nested map by mechanic and bucket avoids delimiter collisions. Shared cooldown
groups deliberately use the same identity; unrelated traits must never share a key accidentally.

Only add a bucket dimension when current mechanics need it. The existing allied stance, charge-recipient, and summon
identities should supply those keys. Grant-lifetime buckets are removed on expiry; ordinary trait identities remain for
the run. Snapshot replay cannot clear this registry. Intentional resets call a platform clear operation explicitly.

Claim sequence:

1. Check event survival, actor eligibility, selected traits/equipment, and required target state.
2. Resolve the cooldown identity and duration from the active catalog.
3. Validate inputs and atomically test/claim the cooldown in the current phase.
4. Emit effects only after the claim, so nested reactions cannot claim it again.

Store the duration chosen at the successful trigger. Later tuning/rate queries do not retroactively change that
deadline. Proc ICDs do not pass through Alacrity or the skill recharge controller.

### Boundary decision

Implemented 2026-09-24 after user approval: sigils now use the shared strict `isInternalCooldownReady` predicate in both
phases, and the sigil-only helper is removed. Critical procs use seeded rolls in both modes, while deterministic weapon
strength remains midpoint and damage keeps its average critical multiplier. See
[the investigation](SIGIL-ICD-INVESTIGATION.md) for the isolated boundary experiment, combined benchmark impact, and
remaining log mismatch.

An armed ICD blocks exactly at its canonical deadline and permits a later eligible event. The existing zero-as-unarmed
convention remains; the registry/storage migration below is separate outstanding work. Some profession handlers still
use raw or EPSILON-adjusted comparisons and must be audited before migrating them.

New registry representation:

- Missing entry means unarmed; a real deadline of zero is a real deadline. Remove the zero-as-unarmed convention when
  migrating the predicate and all its callers together.
- A positive-duration successful claim records a canonical deadline. At 2.000000 seconds, a strict deadline of 2 seconds
  blocks; at 2.000001 it permits the next eligible trigger. ICDs are not quantized to the 40 ms action grid.
- Zero-duration claims succeed without arming a cooldown. Deduplication is a separate concern and must not depend on a
  special case at time zero.
- Disabled equipment/procs fail eligibility rather than manufacturing infinite timestamps in the new registry.
- Reject negative/non-finite durations and invalid timestamps even when an existing cooldown would otherwise block.

### Critical procs, charges, and predictions

Retain `advanceCriticalProc` as the owner of sampled critical opportunities, secondary rolls, and materialization. It
must use the same cooldown registry/predicate and claim exactly once when its application is earned. Remove its
duplicate deadline storage during that migration; do not wrap it in a second independent cooldown claim. Do not consume
randomness differently as an incidental result of moving storage. Critical accumulation has been removed.

Charge consumption keeps charge eligibility and expiry rules. Check that a usable charge exists, claim its applicable
cooldown, then consume it before effects execute. Preserve whether a refreshed grant shares the recipient cooldown or
starts a new application cooldown; grant generation alone must not be used to reset every recipient's ICD.

Scheduler predictions and resolver outcomes use the same rules with separate state. Continue filtering scheduler-only
predictions before resolver replay. Never copy predicted cooldown deadlines into resolver state or serialize internal
proc registries as profession snapshots.

### Migration sequence

1. Inventory all checks, assignments, initializers, intentional resets, and sharing scopes. Record strict, inclusive,
   and EPSILON-based boundary users before editing them.
2. Add phase-owned storage and migrate a strict-rule trait family already using `tryConsumeProcCooldown`.
3. Migrate the remaining matching traits, removing their obsolete cooldown fields and snapshot preservation code.
4. Resolve the boundary decision, then migrate sigils, relics, and ad hoc stance/upkeep procs under the chosen rule.
5. Integrate critical proc trackers and charge-backed cooldowns, preserving seeded outcomes, recipient scope, and grant
   lifetime.
6. Remove obsolete predicates and deadline stores. Update the clock specification and code-health handoff to describe
   the final rule, including any evidence-backed exceptions.

## Validation and completion criteria

Use minimal engine-contract scenarios. No new tests for Quickness cast times, interrupt-commit values, complete result
snapshots, or exact saved-rotation shapes.

Resource checks:

- One long wait and equivalent split waits produce the same amount, next pulse, and depletion outcome.
- At cap, recovery loses overflow but preserves cadence. Grants settle preceding drain before clamping.
- Rate/cap transitions preserve earned fractions; capacity increases do not refill the pool.
- Multi-pulse affordability, disabled recovery, impossible costs, and known future grants terminate correctly.
- Future/cancelled/off-target gains, equal-time mutations, and depletion replacement obey causal ownership.
- Depletion consequences execute once, with no stale task after exit or re-entry.
- Selected catalog overrides agree across initialization, simulation, projections, and previews.
- Negative inputs, backwards time, and failed spends do not partially mutate resource state.

Proc checks:

- First trigger at zero, exact deadline, one microsecond before/after, zero duration, and canonical floating-point
  equality.
- Two eligible events at one timestamp have one positive-duration winner, including nested reactions.
- Ineligible/cancelled events do not claim; invalid requests fail consistently.
- Independent recipients/actors remain independent; intentional shared groups share a cooldown.
- Scheduler predictions and resolver replay are independent; snapshots cannot rearm or roll back cooldowns.
- Seeded critical behavior and charge refresh/expiry survive the storage migration.

For each migration, run relevant focused tests and affected preset smoke/DPS checks. Numerical preset assertions compare
only total DPS to the manifest within 1%; investigate deviations and warnings rather than relaxing tolerance or silently
rewriting manifests. Complete each system with module/site builds, type checking, lint, the full Node suite, and focused
browser checks for changed previews/meters. Format every touched supported file with Prettier.

## Implementation checklist

- [x] Record the design, existing foundations, ownership boundaries, and unresolved simulation decision.
- [x] Inventory resource transitions, mutation callers, cadence policies, and equal-time ordering.
- [x] Implement the shared resource lifecycle and migrate tome pages/Galeshot arrows.
- [x] Migrate initiative, then Specter/Druid draining resources.
- [x] Migrate Revenant Energy, then Necromancer Life Force; remove superseded clocks/queues.
- [x] Assess endurance integration against its existing Vigor contracts.
- [ ] Inventory proc cooldown boundaries, phase owners, buckets, and resets.
- [ ] Add phase-owned proc storage and migrate existing strict-rule consumers.
- [ ] Resolve and document the exact-boundary policy before changing affected consumers.
- [ ] Migrate remaining equipment/profession procs, critical trackers, and charge cooldowns.
- [x] Remove obsolete resource state fields/helpers and update projections and fixtures.
- [ ] Remove obsolete proc state fields/helpers when that separate migration is authorized.
- [x] Complete resource validation and record results here.
- [ ] Complete proc validation after its separate implementation.

## Implemented resource lifecycle

`platform/combat/resources/resource-policy.ts` is the scheduler-facing controller. It uses the existing clock
arithmetic, owned task queue, and depletion helper. `resources` selects policies; clocks remain in profession Core or
specialization state. Numeric state aliases and profession-maintained recovery loops for the migrated pools are removed.

| Pool         | Canonical owner              | Recovery and transition rules                                                                                                                                                                                                                                                                                                                                        |
| ------------ | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tome pages   | Firebrand `tomePages`        | First-spend cadence; partial initial pools start recovering immediately. Costs and Swift Scholar refunds commit on completion; Weighty Terms and Renewed Focus grants use their authored timestamps.                                                                                                                                                                 |
| Arrows       | Galeshot `arrows`            | Cadence starts immediately and continues at cap. Cast-start costs/grants remain cast-start operations; impact reactions grant at their task timestamps. `restoreArrow` is removed; consumers call `grantResource`.                                                                                                                                                   |
| Initiative   | Thief Core `initiative`      | Preparedness selects capacity; kneeling explicitly refreshes the rate. Delayed skill and signet grants execute through owned tasks.                                                                                                                                                                                                                                  |
| Shadow Force | Specter `shadowClock`        | Shared drain and depletion; profession code retains entry, exits, and percentage formulas. Trivial `gainShadowForce` wrapper is removed.                                                                                                                                                                                                                             |
| Astral Force | Druid `astralClock`          | Shared drain, retention spending, and maximum Avatar duration. Natural Mender is a timed effect; a pulse coincident with Avatar expiry remains suppressed. Damage grants check the surviving event.                                                                                                                                                                  |
| Energy       | Revenant Core `energy`       | Shared net regeneration/upkeep rate. Precombat recovery stops at 50 without discarding larger grants, and insufficient precombat costs do not auto-wait. Combat facts refresh the ceiling. Upkeep activation starts at completion; facet consumption removes upkeep at cast start while recharge starts at completion. Starvation precedes same-time upkeep effects. |
| Life Force   | Necromancer Core `lifeForce` | Shared shroud drain; percentage conversion and Gluttony remain local. Depletion precedes same-time passive grants. Eternal Life and signets retain independent pulse eligibility. Lich has an exact expiry task. Ritualist overrides the policy for Lingering Spirits outside shroud.                                                                                |

Continuous observations retain a private fixed accrual anchor per clock, replaced only by mutations or tuning changes.
Public clocks contain settled values; snapshots and planning projections detach those values. This preserves threshold
and depletion timing across split waits without rounding away fractional resources. Previews query selected policy
capacities against the active catalog and run no depletion or pulse callbacks.

Discrete interval changes retain a pending pulse and use the new interval afterward. Disabling recovery removes its
pending deadline; re-enabling starts a fresh eligible cadence. Grants and resets preserve a running cadence.

Future grants, resets, and refreshes reuse scheduler tasks. Affordability can retry those boundaries without crediting
unexecuted grants; a cost above current capacity only retries a known capacity-refresh task. Hit-funded Life Force and
Astral Force reactions retain event identity and check cancellation/off-target state. Scourge's Nourishing Ashes checks
its existing cooldown predicate at that causal timestamp; its cooldown storage and boundary rule are unchanged.

Endurance intentionally retains its existing capability and interval arithmetic. Its recovery depends on surviving Vigor
intervals across a wait, which cannot be represented correctly by this controller's single sampled rate. The existing
endurance/Vigor contracts remain part of full-suite validation.

Validation completed:

- All 3,736 Node tests pass, including saved-preset checks within the existing 1% total-DPS tolerance.
- Focused contracts cover split waits, delayed/cancelled grants, changing capacity/rates, disabled recovery,
  tick-aligned readiness, discrete cadence, and depletion ordering. Thief can wait for signet grants with zero
  regeneration; Druid waits for actual delayed hit grants before entering Avatar.
- Module/site builds, lint, type checking, and distribution/site output checks pass.
- Focused browser checks cover startup, profession workspaces, worker isolation, and resource meters across five
  professions. All 15 checks passed across the runs; one cold-start artwork visibility check failed initially and passed
  on retry alongside the fallback-artwork case.
- Every touched supported file was formatted with Prettier; `git diff --check` passes.

Proc cooldown implementation and its validation remain pending as a separate task.
