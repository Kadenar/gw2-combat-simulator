# GW2 platform ownership

Place each module in the domain responsible for its behavior. Shared platform code receives profession contributions; it
does not import concrete professions, application code, or integrations. `simulation/simulate.ts` exposes the public
simulation entry point, `simulateGw2`; consumers import every contract directly from its canonical owner.

| Directory                  | Owns                                                                                                                                                       | Delegates                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `constants.ts`             | Shared boon, condition, aura, control, combo, actor, recipient, weapon, and status vocabulary                                                              | Domain behavior                                                  |
| `builds/`                  | Saved schemas and rotation commands, normalization, validation, loadouts, selections, assumptions                                                          | Live resources, scheduling, rendering                            |
| `skills/`                  | Skill identities, immutable catalogs, validation, balance profiles, shared actions, chain indexes                                                          | Cast acceptance, recharge, effect application                    |
| `events/`                  | Event schemas, the shared resolver packet type, audience/metadata validation, actor identities, packet identity contracts                                  | Queues, clocks, handlers, history                                |
| `attributes/`              | Attribute inputs and seeds, stat contracts, common/finalized calculation, contributions, passives                                                          | Saved-build schemas, live-state mutation and damage resolution   |
| `effects/`                 | Effect declarations, validation, materialization, emission, actions, packet builders                                                                       | Cast acceptance, target gating, hit resolution, resource storage |
| `combat/`                  | Formulas, modifiers, basic state queries, target/boon state, resources, procs, executed history, action ticks, effect duration/expiry, recharge arithmetic | Equipment aggregation, rotation driving and result assembly      |
| `combat-calculation/`      | Effective combat attributes and multipliers from combat calculations, equipment rules, profession hooks, and timestamped state                             | State mutation, scheduling and isolated skill measurement        |
| `combos/`                  | Fields, finishers, descriptors, combo state and rules                                                                                                      | Clock ownership and damage resolution                            |
| `equipment/`               | Gear, consumables, weapons, sigils, relics, item-owned state and proc rules                                                                                | Global scheduling and rotation traversal                         |
| `execution/`               | Rotation traversal, cast lifecycle, readiness, cooldown/ammo progress, lockouts, flips, live attack chains                                                 | Hit/condition resolution and reporting                           |
| `resolver/`                | Packet admission/delivery, event phases, handlers, reactions, strikes, conditions, combos                                                                  | Rotation decisions and clock advancement                         |
| `profession-definition/`   | Authoring APIs, module/catalog assembly, compilation, runtime/family contracts, capability contexts                                                        | Concrete profession mechanics and browser integration            |
| `profession-presentation/` | Headless UI contracts/composition, display groups and preview-control hooks                                                                                | Saved-build validation and damage calculation contracts          |
| `skill-damage/`            | Isolated occurrence inputs, driver, measurement, variants, cache, calculation errors                                                                       | A separate damage formula or runtime loop                        |
| `results/`                 | Optional observers, detached combat/planning projections, result queries, APM, boon summaries                                                              | Authoritative gameplay history and live-state mutation           |
| `simulation/`              | Public run options/configuration, owner construction, one queue/clock, causal scope, stop policy                                                           | Domain rules and build-control definitions                       |

Profession implementations live in `../professions/<profession>/`. Optional patch authoring and overlays belong in
`../integrations/patches/`; equipment picker icons belong in `../app/shared/equipment/icons.ts`. See
[Simulator modules](../../../../docs/architecture/MODULES.md) for the wider map.

## Execution and mutation authority

`simulation/runtime.ts` assembles one run. `simulation/coordinator.ts` owns its heap, logical clock, causal identity,
and execution loop. `resolver/event-phase.ts` selects packet phases; it does not run another loop. Commands, tasks,
hits, procs, and condition wakes settle on the same clock.

`execution/cast-execution.ts` owns readiness, acceptance, reservations, in-flight tracking, lockouts, and completion.
`execution/cast-contracts.ts` declares accepted cast facts and narrow cast-control operations. `execution/cooldowns.ts`
privately owns cooldown deadlines, recharge progress, and ammo pools. Cast readiness, live formula queries, and planning
projections use its operations and observations; `Gw2Runtime` exposes no recharge maps. Live formula queries retain
unrounded deadlines and settle only the requested magazine; cast admission and public deadlines retain action-tick
rounding. `combat/recharge.ts` calculates recharge rates and progress. Static chain indexes live in
`skills/autoattack-chain-index.ts`, while `execution/autoattack-chains.ts` privately owns per-run progress and live
transitions. Mechanics can read or reset that progress; only execution advances it. Replacing profession state does not
replace chain progress. Planning publishes detached expected steps under `STATE.AUTOATTACK_CHAINS`, including root
defaults for every declared chain.

Service owners construct frozen query and mechanic views. Their interfaces declare progressively wider operations;
returned objects expose only the permitted methods. Deferred queries follow owner replacement without reading an unbound
owner during construction.

`skills/input-controls.ts` owns logical control identities, selected skill bars, and replacement ancestry lookup.
`skills/autoattack-chain-index.ts` classifies automatic versus manual activations. `execution/input-controls.ts`
resolves the control at cast acceptance and declares accepted input facts; `results/input-trace.ts` only projects those
facts into detached reporting windows. Consumers import each contract directly from its owner.

`resolver/effect-delivery.ts` owns packet admission/preparation, target gates, immediate conditions, and reaction
settlement. `effects/emission.ts` validates and detaches requests, materializes declarations, and returns immutable
receipts. `effects/actions.ts` declares actions; `effects/action-dispatch.ts` applies them through explicit resource,
recharge, flip, and emission services. `resolver/effect-reactions.ts` receives its action dispatcher from simulation. It
selects eligible reactions without importing simulation construction or acquiring resource stores.

Simulation owns task admission, detached work, causal scope, and queue cancellation. Execution supplies cast facts;
delivery supplies packet lifetime ownership. Generation cancellation must not erase separately owned committed
projectiles.

Resource modules own balance settlement, policy application, and depletion deadlines. Simulation owns wake generations
and cancellation. Resource arithmetic receives clock and policy inputs without the aggregate runtime.

`combat/history/executed-facts.ts` is the gameplay history in every output mode. Its factory returns separate readers
and writers. Mechanic queries receive only `facts`; registered mechanic handlers receive the explicit `observations`
writer for custom transitions and action interruptions. Delivery records ordinary executed facts through that same
store. Recording remains independent of optional chart/report collection.

`equipment/relics/runtime.ts` owns the equipped relic and supported precast relics. A relic selected for both roles
shares one state and cooldown. Execution and resolver stages call its rule hooks. It resolves delayed activations by
relic ID, including precast activations that occur after combat starts. It also supplies buff policies and isolated
damage payloads. The simulation controls scheduling and reaction order.

Relic callers cannot access mutable rule state. Live calculations use the owner's queries. Detached timeline queries
keep the equipped relic's base context without replaying earned stacks or precast buffs. The attribute preview supplies
hypothetical Aristocracy stacks through a separate query factory.

## Declaration and calculation boundaries

`combat-calculation/combat-query.ts` combines combat calculations, equipment rules, and profession hooks for live
combat, attribute previews, and timestamped queries; `combat-calculation/timeline-index.ts` indexes the event history
behind those queries. `combat/query/runtime-query.ts` and `combat/query/effect-stacks.ts` provide basic state checks and
stack lookup without importing equipment implementations. `skill-damage/` runs and measures isolated skill occurrences
using the shared combat calculations.

Selected profession compilation creates one immutable calculations value shared by normalized selection and runtime
modes. Attribute queries apply actor ownership, weapon-set context, one contribution sample, Might, profession and
equipment attributes, independent summon projection, then final condition replacements. Repeated reads at the same
timestamp resample live facts.

Combat helpers declare the capabilities they need without importing aggregate simulation or resolver runtimes.
`combat/procs/registry.ts` reads the live clock, selected balance profiles, and recharge intervals through
`ProcRegistryContext`. `combat/modifiers.ts` uses `Gw2ModifierState` for profession and boon observations without
exposing scheduling, cast control, or reporting stores.

`skills/catalog.ts` merges declarations and builds immutable indexes. `skills/validation.ts` validates skill fields and
catalog references; `effects/validation.ts` validates effect payloads and canonical effect lists. External GW2 identity
normalization belongs to `skills/external-skill-ids.ts`; these mappings are domain data, not obsolete module aliases.

`profession-definition/profession.ts` is the public native compiler; `compile-contract.ts` handles internal contract
compilation. `runtime-contract.ts` declares the compiled runtime and `family-contract.ts` joins the runtime, build, and
lazily initialized UI interfaces. Headless compilation and simulation never initialize presentation factories.

`profession-definition/runtime-hooks.ts` defines the author contribution interface directly; the compiled runtime
extends this interface. Composition rejects unsupported fields and duplicate named handlers while preserving
notification order, transforms, retry precedence, and policy selection. Catalogs, state factories, weapon eligibility,
attack chains, and planning projections belong to `RuntimeProfession`. The shared `weaponSkillMatchesSet` policy serves
simulation and application adapters.

Authoring APIs never import the aggregate `Gw2Runtime`. Dedicated selection, content, recharge, capacity, cast-detail,
and effect-ownership contexts live in `profession-definition/runtime-context.ts`. Shared capabilities live in
`profession-definition/mechanic-context.ts`:

- `MechanicQueryContext`: read-only profession state, service queries, and executed facts.
- `MechanicCombatContext`: owned-state mutation and combat, emission, proc, and random services.
- `MechanicContext`: combat capabilities plus lifecycle, cast/resource/recharge operations, scheduling, and observation
  writes.

`simulation/bind-mechanic-context.ts` assembles owner-provided capabilities and live state getters; it does not maintain
service method allowlists. `resolver/mechanic-services.ts` owns combat operations and its restricted query view. These
mechanic capabilities expose neither the command cursor, shared heap, cast maps, nor report collections. The existing
effect-delivery integration still receives the aggregate runtime; it is distinct from profession-facing capabilities.

`skill-damage/types.ts` owns measurement contracts; presentation adds labels/groups. `occurrence-driver.ts` selects
isolated work, `run-occurrence.ts` runs it through the shared runtime, and `measure-occurrences.ts` owns measurement,
variants, statuses, and caching. Isolated execution does not register unrelated combat producers or costs.

Finite occurrence observation follows owned pending effects, allied grants, and accepted condition facts. Execution and
result projection share that policy; only the coordinator inspects the queue and advances the clock.

Authored effects and runtime packets share scalar strike inputs while retaining distinct timing, ownership, metadata,
and resolved facts. Materialization applies defined tick overrides directly to the packet; emission detaches nested
payloads.

Saved randomness controls and conversion live in `builds/randomness-assumptions.ts`; critical damage policy
normalization belongs to `combat/critical-damage-mode.ts`. Generic random generation remains in the kernel.

## Observation, units, and simulation scope

`results/types.ts` declares public results/planning projections; `simulation/options.ts` declares run requests.
`results/project-runtime.ts` selects damage, score, or detailed output after execution settles. Results own display
aggregation and breakdown row contracts. Simulation supplies an optional damage observer to resolution only for detailed
output, including charts-off runs; its detached projector stays in composition. Score and owned-damage modes do not
construct it. Accepted totals, first/last damage time, target death, live condition state, and gameplay history remain
independent of reporting. Environment condition payouts retain their shared first-player-hit phase even though
environment DPS has a separate window.

`results/combat-result.ts` combines detached damage projections and events; `results/resolved-events.ts` clips detached
condition observations without changing live application lifetimes or settlement records. Optional effect observers
maintain reporting history, but reporting cannot advance gameplay or supply required gameplay facts.

`results/planning-state.ts` observes planning at the requested boundary, including command continuation after target
death. Combat results use the earlier combat boundary. These observations are not resumable checkpoints.

Live clock and event timestamps use seconds; authored `*Ms` fields, rotation step times, and public cooldown projections
use milliseconds. `execution/cast-timing.ts` owns cast timing. `combat/effect-timing.ts` keeps duration rounding
separate from absolute expiry; both can use the shared GW2 action-tick arithmetic in `combat/action-tick.ts`.

Player health is fixed at 100% during every combat simulation. Only the isolated attribute preview may vary player
health; its inputs remain separate from saved builds and simulation configuration. Target health remains modeled by
`combat/state/target-health.ts` and the configured target state.

## Enforcement

ESLint enforces shared-platform isolation, declaration boundaries, execution/resolver separation, gameplay-history
independence, and presentation's dependence on calculation contracts. Simulation implementations are importable within
the platform only by simulation and isolated measurement; run/config/work contracts remain available to consumers.

`tests/architecture/platform-ownership.test.mjs` checks static, type, and dynamic imports, verifies that platform
imports resolve, and rejects value dependency cycles. Type relationships may be recursive when domain contracts require
it. Comments explain intended behavior and invariants. Update consumers directly when an owner moves; do not add
compatibility paths.
