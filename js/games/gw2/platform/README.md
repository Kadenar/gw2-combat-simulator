# GW2 platform ownership

Put a module beside the domain that guarantees its behavior. Shared platform code receives profession contributions; it
does not import concrete professions, application code, or integrations. `index.ts` exposes the public simulation entry
point; consumers import other contracts directly from their canonical owners.

| Directory                  | Owns                                                                                                      | Delegates                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `builds/`                  | Saved schemas, normalization, validation, attributes, loadouts, assumptions, chat codes                  | Live resources, scheduling, rendering                            |
| `skills/`                  | Skill identities, immutable catalogs, validation, balance profiles, shared actions, chain indexes         | Cast acceptance, recharge, effect application                    |
| `events/`                  | Event schemas, actor identities, packet identity contracts                                                | Queues, clocks, handlers, history                                |
| `effects/`                 | Effect declarations, validation, materialization, emission, actions, duration/expiry policy               | Cast acceptance, target gating, hit resolution, resource storage |
| `combat/`                  | Formulas, modifiers, queries, target/boon state, resources, executed history, action-tick arithmetic      | Rotation driving and result assembly                             |
| `combos/`                  | Fields, finishers, descriptors, combo state and rules                                                     | Clock ownership and damage resolution                            |
| `equipment/`               | Gear, consumables, weapons, sigils, relics, item-owned state and proc rules                               | Global scheduling and rotation traversal                         |
| `execution/`               | Rotation commands, cast lifecycle, readiness, cooldown/ammo progress, lockouts, flips, live attack chains | Hit/condition resolution and reporting                           |
| `resolver/`                | Packet admission/delivery, event phases, handlers, reactions, strikes, conditions, combos                 | Rotation decisions and clock advancement                         |
| `profession-definition/`   | Authoring APIs, module/catalog assembly, compilation, runtime/family contracts, capability contexts       | Concrete profession mechanics and browser integration            |
| `profession-presentation/` | Headless UI contracts/composition, display groups and preview-control hooks                               | Saved-build validation and damage calculation contracts          |
| `skill-damage/`            | Isolated occurrence inputs, driver, measurement, variants, cache, calculation errors                      | A separate damage formula or runtime loop                        |
| `results/`                 | Optional observers, detached combat/planning projections, result queries, APM, boon summaries             | Authoritative gameplay history and live-state mutation           |
| `simulation/`              | Public run options/configuration, owner construction, one queue/clock, causal scope, stop policy          | Domain rules and build-control definitions                       |

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
rounding. Recharge work arithmetic belongs to `execution/recharge.ts`. Static chain indexes live in
`skills/autoattack-chain-index.ts`, while `execution/autoattack-chains.ts` owns live transitions.

`resolver/effect-delivery.ts` owns packet admission/preparation, target gates, immediate conditions, and reaction
settlement. `effects/emission.ts` validates and detaches requests, materializes declarations, and returns immutable
receipts. `effects/actions.ts` declares actions; `effects/action-dispatch.ts` applies them through explicit resource,
recharge, flip, and emission services. `resolver/effect-reactions.ts` receives its action dispatcher from simulation. It
selects eligible reactions without importing simulation construction or acquiring resource stores.

`simulation/work-contract.ts` declares internal task data and lifetime generations. `simulation/internal-work.ts`
constructs validated detached work. Execution/delivery receive that factory through their host contracts. Generation
cancellation must not erase committed projectiles. `execution/cast-timing.ts` owns cast-relative task deadlines.

`combat/history/executed-facts.ts` is the gameplay history in every output mode. Its factory returns separate readers
and writers. Mechanic queries receive only `facts`; registered mechanic handlers receive the explicit `observations`
writer for custom transitions and action interruptions. Delivery records ordinary executed facts through that same
store. Recording remains independent of optional chart/report collection.

## Declaration and calculation boundaries

`skills/catalog.ts` merges declarations and builds immutable indexes. `skills/validation.ts` validates skill fields and
catalog references; `effects/validation.ts` validates effect payloads and canonical effect lists. External GW2 identity
normalization belongs to `skills/external-skill-ids.ts`; these mappings are domain data, not obsolete module aliases.

`profession-definition/profession.ts` is the public native compiler. Its internal contract compilation stage lives in
`profession-definition/compile-contract.ts`; public state helpers remain in `profession-definition/state.ts`.
`runtime-contract.ts` declares the compiled runtime; `family-contract.ts` joins runtime, build, and lazy UI surfaces.
Authoring contracts never import the aggregate `Gw2Runtime`.

`profession-definition/runtime-hooks.ts` defines `RuntimeHooks<State, TSkill>`, the contribution type used by modules,
rule compilation, and composition. Composition rejects unsupported fields and duplicate named handlers while preserving
notification order, transforms, retry precedence, and policy selection. Catalogs, state factories, weapon eligibility,
attack-chain overrides, and planning projections belong to the compiled `RuntimeProfession`, outside hook contributions.

All callback families use canonical author capabilities. `profession-definition/runtime-context.ts` declares dedicated
selection, content, recharge-anchor, capacity, cast-detail, and effect-ownership contexts.
`profession-definition/mechanic-context.ts` declares the shared capabilities:

- `MechanicQueryContext` lets selection and observation callbacks inspect read-only profession state, service queries,
  and executed facts.
- `MechanicCombatContext` lets combat helpers mutate owned profession state and use combat, emission, proc, and random
  services.
- `MechanicContext` extends the combat capability with lifecycle operations: cast/resource/recharge services, named
  scheduling, and explicit observation writes.

`simulation/bind-mechanic-context.ts` binds stable query and lifecycle views to the live run, and
`resolver/mechanic-services.ts` binds combat operations to resolver-owned stores. `combat/history/executed-facts.ts`
provides separate `facts` readers and `observations` writers in every output mode. Author capabilities do not expose the
command cursor, shared heap, cast maps, or report collections.

Weapon eligibility is the profession's shared `weaponSkillMatchesSet` policy, consumed by simulation and application
adapters. Headless compilation/simulation never initializes presentation factories.

`skill-damage/types.ts` owns measurement inputs, cast options, payload definitions, and outputs. Presentation imports
these contracts and adds labels/groups. `occurrence-driver.ts` selects isolated work, `run-occurrence.ts` executes it
through the shared runtime, and `measure-occurrences.ts` handles measurement, variants, statuses, and caching. Isolated
execution does not register unrelated combat producers or costs.

Saved randomness controls and conversion live in `builds/randomness-assumptions.ts`; critical damage policy
normalization belongs to `combat/critical-damage-mode.ts`. Generic random generation remains in the kernel.

## Observation, units, and simulation scope

`results/types.ts` declares public results/planning projections; `simulation/options.ts` declares run requests.
`results/project-runtime.ts` selects damage, score, or detailed output after execution settles.
`results/combat-result.ts` builds detached rows/events; `results/resolved-events.ts` clips detached condition
observations without changing live application lifetimes or settlement records. Optional effect observers maintain
reporting history, but reporting cannot advance gameplay or supply required gameplay facts.

`results/planning-state.ts` observes planning at the requested boundary, including command continuation after target
death. Combat results use the earlier combat boundary. These observations are not resumable checkpoints.

Live clock and event timestamps use seconds; authored `*Ms` fields, rotation step times, and public cooldown projections
use milliseconds. `execution/cast-timing.ts` owns cast timing. `effects/timing.ts` keeps duration rounding separate from
absolute expiry; both can use the shared GW2 action-tick arithmetic in `combat/action-tick.ts`.

Player health is fixed at 100% during every combat simulation. Only the isolated attribute preview may vary player
health; its inputs remain separate from saved builds and simulation configuration. Target health remains modeled by
`combat/state/target-health.ts` and the configured target state.

## Enforcement

ESLint enforces shared-platform isolation, declaration boundaries, execution/resolver separation, gameplay-history
independence, and presentation's dependence on calculation contracts. Simulation implementations are importable only by
simulation, isolated measurement, and the public entry point; run/config/work contracts remain available to consumers.

`tests/architecture/platform-ownership.test.mjs` checks static, type, and dynamic imports, verifies that platform
imports resolve, and rejects value dependency cycles. Type relationships may be recursive when domain contracts require
it. Comments explain intended behavior and invariants. Update consumers directly when an owner moves; do not add
compatibility paths.
