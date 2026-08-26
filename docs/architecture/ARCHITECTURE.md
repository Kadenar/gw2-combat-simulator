# Profession-neutral simulator architecture

How the simulator is composed, the contracts each layer exposes, and the workflow for adding a profession. For a
directory-level reference of what each module and folder owns, see [MODULES.md](./MODULES.md).

## Contents

- [Layers](#layers)
- [Key concepts](#key-concepts)
- [Dependency rules](#dependency-rules)
- [Declarative profession mechanics layout](#declarative-profession-mechanics-layout)
- [Profession contract](#profession-contract)
- [Phase-explicit native helpers](#phase-explicit-native-helpers)
- [Events](#events)
- [Skills, traits, and rotations](#skills-traits-and-rotations)
- [Builds](#builds)
- [Included professions](#included-professions)
- [Adding another profession](#adding-another-profession)

## Layers

The simulator is composed in three layers:

```text
js/
  platform/
    engine/        deterministic scheduling, events, handlers, contracts
    gw2/           common combat, equipment, sigils, relics, attributes
    ui/            palette/resource/timeline/log/result/chart view models
  professions/
    mesmer/        Mesmer catalog, build schema, state, rules, and mechanics
    guardian/      Guardian API catalog, virtues, rules, and declarative skills
    necromancer/   Necromancer catalog, shrouds, summons, rules, and adapter
    engineer/      Engineer catalog, kits, heat, mech, and Amalgam mechanics
    revenant/      Revenant catalog, legends, energy, and Conduit mechanics
    ranger/        Ranger catalog, pets, astral force, and Galeshot mechanics
    warrior/       Warrior catalog, burst, adrenaline, and Bladesworn mechanics
    thief/         Thief catalog, initiative, stealth, and artifact mechanics
    elementalist/  Elementalist catalog, attunements, rules, and mechanics
  app/             browser composition and persistence adapters
```

### Shared attribute assembly

Common GW2 attribute assembly and derived-stat finalization live in `js/platform/gw2/attributes.ts`; profession
calculators own only their resolved trait and skill deltas. The shared `calculateCommonAttributes()` assembles
equipment, consumables, infusions, sigils, and base derived stats. Native professions pass their resolved deltas to
`finalizeBuildAttributes()`, which rebuilds critical chance, critical damage, boon duration, and condition duration.

### Profession composition boundary

Elementalist uses the shared scheduler and resolver. Its profession directory owns attunements, weapon mechanics,
specialization state, rules, resolver extensions, build migration, and UI configuration.

Profession-specific browser rendering follows the same boundary. The shared shell receives a profession application
adapter for its build codec, storage key, runtime/config builder, renderer hooks, filenames, specialization fallback,
supported relic list, and background contribution worker. The shared rotation renderer consumes profession
palette/resource view models and canonical result state. Profession-specific timeline, log, fixed-bar, resource, and
palette availability behavior is supplied by each profession UI definition.

The shared native-profession rotation palette renders both configured weapon sets when the profession uses ordinary
weapon swaps. Only the active set is context-enabled; inactive-set skills remain visible so their cooldown state can
still be inspected.

The registry-driven profession selector routes between every registered application while preserving one visual system
and independent persisted builds.

## Key concepts

- **Build** — complete character configuration: gear/prefixes, weapons/sigils, runes/relics, food/utility, infusions,
  trait selections, skill selections, and assumptions (boons/target state).
- **Rotation** — ordered sequence of skill activations with optional timing offsets, representing the player's action
  sequence.
- **Simulation pass** — a single execution of a rotation under specific config: determines when skills activate,
  calculates damage, applies conditions, and tracks cooldowns.
- **Attributes** — stats derived from a build (Power, Precision, Ferocity, Expertise, Concentration) plus derived
  metrics like critical chance, critical damage, and duration bonuses.
- **Event** — an atomic timestamped action (skill cast, cooldown, resource change, condition, damage, trait proc) that
  flows through the scheduler → resolver pipeline.
- **Resolver** — the post-scheduler phase that converts timed events into damage numbers using calculated attributes and
  condition formulas.

## Dependency rules

- `platform/engine` imports no GW2, UI, or profession modules.
- `platform/gw2` may import `platform/engine`, but no profession.
- `platform/ui` consumes contract view models and imports no profession.
- A profession may import engine and shared GW2 modules.
- `app` is the composition root and may import every layer.

`tests/platform/platform-architecture.test.js` enforces these rules and rejects profession terminology inside the
platform tree.

## Declarative profession mechanics layout

Every native profession — Elementalist, Engineer, Guardian, Mesmer, Necromancer, Ranger, Revenant, Thief, and Warrior —
uses the typed authoring layer in `platform/gw2/native-profession.ts`. A native module is a vertical slice with four
explicit sections:

- `data` owns generated identities, skill mechanics and overrides, extra skills, traits, specialization metadata,
  handlers, weapon hands, and chain exceptions;
- `state.scheduler` creates scheduler state, optional `state.resolver` creates distinct resolver state, and optional
  `state.project` defines the public end-state projection;
- `mechanics` owns modifiers, availability, cast lifecycle declarations, and resolved-event reactions; and
- `presentation` owns UI contributions. It may be a catalog-aware factory when labels or palettes require the complete
  application catalog.

`defineNativeModule()` retains each module's literal ID and inferred state type. `defineNativeProfession()` requires
Core first, infers the active-state union and specialization IDs, and compiles to the existing engine
`defineProfessionFamily()` contract. The engine contract remains the execution boundary; the native layer is authoring
syntax, validation, and assembly.

Catalog ownership is module-first. `createNativeModuleData()` selects generated metadata for one semantic owner and
combines it with locally authored mechanics. `assembleNativeApplicationCatalog()` derives the complete editor and build
catalog from all modules. Runtime catalog fragments are derived from the same contributions and contain Core plus only
the selected specialization. There is no second ownership table to synchronize. Duplicate IDs, handlers, weapon hands,
invalid specialization-only IDs, unused handlers, and handlers owned by the wrong runtime slice fail during assembly.
Weapon skills default to Core runtime ownership for Weaponmaster-style access; a module may explicitly declare
exceptions in `specializationOnlySkillIds`.

The normal author workflow is:

1. Author raw mechanics and feature behavior in the owning Core or elite directory.
2. Build the slice's `data` with `createNativeModuleData()` and declare state, mechanics, and presentation with
   `defineNativeModule()`.
3. Add the module to the profession's Core-first tuple in `modules.ts`.
4. Export `assembleNativeApplicationCatalog(modules, options)` through the stable root `catalog.ts`; do not hand-build
   runtime fragments.
5. Keep browser persistence and rendering composition in `app/app-definition`, separate from the engine-facing family
   definition.

Every native profession otherwise uses the same source roles:

- `data/<profession>-api-metadata.ts` is generated presentation and identity metadata. It is never a source of
  coefficients or damaging conditions.
- `data/<profession>-supplemental-skills.ts`, when present, owns identity and presentation for positive-ID skills
  missing from the generated snapshot.
- `data/trait-coverage.ts` classifies every catalog trait with validated behavioral evidence or an explicit out-of-model
  reason.
- `data/traits-data.ts` is the only module that exports the flattened runtime `TRAITS` collection; it derives that view
  from specialization metadata.
- Families keep authoritative ID-keyed declarative skill fields in Core/specialization `skills.ts`. Tests that need a
  profession-wide inventory compose those owner-local fragments under `tests/`; production does not expose a root
  skill-mechanics aggregate.
- Triggered effects and state machines live in owner-local `mechanics.ts` files; families do not use mixed
  profession-wide runtime aggregates.
- `catalog-data.ts` owns inert profession-wide generated metadata and catalog options used by module data selectors.
- `catalog.ts` is a stable application-facing export of the catalog assembled from modules. Runtime modules do not
  import it.
- owner-local `handlers.ts`, when needed, registers `augmentSkill()` or `replaceSkill()` strategies for behavior that
  cannot be represented by declarative effects. Root handler aggregates are unnecessary because the application catalog
  is assembled from module contributions.

Profession-specific state machines remain in named feature modules beside these boundaries. Skill entries reference
those handlers explicitly. The repeatable module authoring and migration requirements are defined in
[MODULES.md](./MODULES.md).

## Profession contract

Create professions with `defineProfession()`:

```js
export const exampleProfession = defineProfession({
  id: 'example',
  name: 'Example',
  catalog,
  build: {
    createBuildDefaults,
    migrateBuild,
    validateBuild
  },
  resources: {
    createProfessionState,
    createResolverState, // optional clean resolver-time initial state
    projectEndState // optional public profession-state projection
  },
  attributeRules,
  castRules,
  schedulerHooks,
  resolverHooks: {
    eventHandlers, // exclusive custom event types
    eventReactions // reactions to standard GW2 event types
  },
  ui: {
    assumptionControls,
    eventLogRow,
    isPaletteSkillInstant,
    paletteSkillAvailability, // { available, message }
    isSlotSkillSelectable,
    paletteGroups,
    resourceViews, // zero, one, or multiple resource view models
    skillBarGroups,
    slotLoadout,
    targetHealthThresholds,
    timelineSkillIcon,
    updateSkillBarSelection,
    weaponSkillMatchesSet,
    weaponSwapChangesSet
  },
  simulation: {
    refineSchedulerConfig // optional immutable feedback-pass refinement
  }
});
```

All hooks are optional. Missing validation accepts the cast, missing modifier hooks return their input, and other hooks
are no-ops. Scheduler hooks and resolver event reactions accept `{ id, order, handler }`; lower order runs first and
declaration order breaks ties deterministically.

Every native profession uses `defineNativeProfession()` and `defineNativeModule()`, which compile to the engine's
`defineProfessionFamily()` and `defineProfessionModule()` boundary. A family is an application contract: it exposes
identity, the complete catalog, build codec, normalized application UI, optional simulation refinement, and
`resolveRuntime(config)`. It does not expose runtime handlers, hooks, rules, or mutable state. `resolveRuntime(config)`
returns the cached executable contract containing Core plus only the selected elite module. `simulateGw2()`, the direct
scheduler, and the direct resolver normalize family sources before constructing runtime state. Ordinary
`defineProfession()` contracts, including test fixtures, pass through unchanged.

Module composition rejects duplicate hook IDs, skill IDs, trait IDs, specialization IDs, task handlers, event handlers,
skill handlers, and weapon-hand declarations. Runtime state is stored as `{ core, specialization: { kind, state } }`.
The container is an ordinary object with no proxy or flat compatibility accessors. Core mechanics address `core`
directly and elite mechanics validate and address only the active specialization state. Missing or `Core` specialization
selects Core alone; unknown elite names fail explicitly.

`createProfessionFamilyUi()` owns application specialization dispatch. Core is selected for a missing specialization,
`"Core"`, a Core trait-line name, or an unknown application-only name. A known elite selects Core plus that elite. Lists
compose Core first and the active elite second, availability callbacks may veto, event presenters delegate on
`undefined`, selection replacement asks the elite first, and resource-anchor palette groups use the active elite's
profession skills. Runtime resolution remains strict for unknown elites.

Modules may contribute inert `attributeRules.modifierRules` declarations. Exactly one module supplies
`compileModifierRules`; the family merges Core and active-specialization declarations and compiles them once. This
preserves the single GW2 additive-damage bucket while excluding inactive specialization modifier declarations.

`defineProfession()` validates every supported callback type and normalizes palette availability into one
`{ available, message }` result. Compatibility boolean/message callbacks are derived from that result. Event presenters
return `{ type, description, className, order, flags }`; `null` deliberately suppresses an internal event and
`undefined` requests the diagnostic fallback.

Native-profession scalar combat bonuses are declared as per-effect rules in owner-local Core or elite `rules.ts`
modules. The shared `platform/gw2/modifier-rules.ts` adapter compiles those rules into the existing critical chance,
critical damage, strike damage, condition damage, and condition duration hooks. It owns scalar sequencing and the single
GW2 outgoing additive-damage bucket rebuild; profession modules own predicates and runtime state. Ordered attribute
conversions remain narrow imperative hooks.

## Phase-explicit native helpers

Native helpers name the execution phase in which behavior runs:

- scheduler: `skillAvailability()` and `afterSkillEffects()`;
- resolver: `onResolvedDamage()`, `onResolvedControl()`, and `onResolvedBlind()`;
- resolved critical procs: `onResolvedCriticalHit()` declares eligibility, state access, materialization, ICD policy,
  attribution, and the profession-owned effect; and
- skill handlers: `augmentSkill()` observes or decorates declarative effects, while `replaceSkill()` owns a skill whose
  declarative effects are empty.

All ordered helpers require stable IDs and accept explicit order values. They compile into existing scheduler cast
rules/hooks or resolver reactions; they do not merge the scheduling and resolution phases.

`advanceCriticalProc()` is the phase-neutral critical-proc kernel. Resolver declarations use it through
`onResolvedCriticalHit()`, while scheduler-owned mechanics use `advanceScheduledCriticalProc()`. Both paths consume the
same canonical sampled hit in stochastic mode and share deterministic threshold progress, weighted applications,
secondary proc rolls, floating-point tolerance, and internal-cooldown behavior. Discrete resolver declarations use
threshold materialization and apply every returned proc quantity; weighted declarations apply fractional quantities
directly.

The higher-level helpers intentionally cover only recurring, order-sensitive mechanics. Raw `mechanics.castRules`,
`mechanics.schedulerHooks`, and `mechanics.resolverHooks` remain escape hatches for typed tasks, custom event types,
complex cooldown/ammo policy, multi-event state machines, and existing hook bundles that do not become clearer when
split. Raw modifier hook bundles are also supported beside typed modifier-rule arrays. Escape hatches must stay
owner-local and must not import inactive specialization behavior.

Shared scheduler state is limited to time, cooldowns, ammo, weapon set, skill uses, pending events, and `profession`.
For families, Core resources live under `state.profession.core`; active-elite resources live under
`state.profession.specialization.state`. Public `endState.profession` remains an allowlisted, compatibility-stable
projection. Typed scheduler tasks carry serializable payloads and are dispatched to namespaced profession handlers.

The neutral engine accepts scheduler policy callbacks. `platform/gw2` supplies the shared GW2 policy for
Quickness-adjusted casts, Alacrity-adjusted recharge, ammo, and the configured starting weapon set. Profession hooks may
then modify cast duration, recharge duration, or maximum ammo without copying the common state machine.

Application and test callers use `simulateGw2()`, which always runs the shared GW2 scheduler, event-stream builder,
resolver, and result builder. Canonical sequence results keep time, cooldowns, ammo, and active weapon set under
`endState`; profession mechanics are exposed only through `endState.profession`.

Observation is caller-owned. `simulateGw2()` accepts `rotation`, `tail`, and absolute observation policies. The
scheduler derives rotation end only from commands and cast-lane reservations, then drains finite profession tasks
through the normalized observation end. The resolver applies target-death clipping and uses that one effective end for
packets, conditions, reactions, and result filtering. Skill, effect, and event metadata cannot extend either boundary.
Saved benchmark metadata cannot select a policy either; benchmark logs and metrics are comparison targets, and benchmark
tooling uses the default rotation boundary.

`persistsAfterInterrupt` controls packet cancellation only. Any skill whose future packets can survive interruption
declares `interruptCommitMs` explicitly; zero means immediate commitment. Persistent actors use typed tasks with an
explicit active-generation, lifetime, or stop condition, and recurring handlers schedule only the next bounded unit of
work.

Scheduler snapshots and public profession state are separate contracts. Snapshots may contain task progress,
deterministic-choice indices, internal cooldowns, and resolver bookkeeping. `resources.projectEndState` constructs a
public allowlisted object containing only resource, palette, timeline, and supported post-simulation inspection fields.

Browser attribute calculation records one shared provenance object:

```js
attributeProvenance: {
  professionStaticRulesApplied: true,
  calculatedWeaponSet: 1,
  calculatedPrimaryWeapon: "Greatsword",
}
```

Direct engine callers normally omit it, causing runtime hooks to apply static profession rules. Browser adapters set it
after build calculation so static rules are applied exactly once. Weapon-dependent rules compare the calculated weapon
against the active runtime weapon after a swap; dynamic combat-state modifiers always remain runtime rules.

`simulation.refineSchedulerConfig(config, result)` supports scheduler decisions that depend on resolved damage state. It
returns a new config object to request another pass, or `null`/`undefined` when converged. The simulator permits at most
five refinement passes. The callback must not mutate its prior config or result; composition rejects top-level mutation,
non-object output, and returning the same config object. Refiners should converge before the pass limit and produce
identical output when rerun with an already-converged result.

The platform scheduler handles ordinary declarative skills and invokes profession hooks for complex behavior. Catalog
skill handlers use a shared strategy contract: augmenting handlers may prepare state, observe each emitted declarative
effect, and finalize the cast; replacing handlers own the complete profile and must declare an empty `effects` list. The
catalog rejects ambiguous replacing-handler/nonempty-effect combinations and undeclared effect fields. Mesmer clone
attacks, resource gains, expected procs, and Continuum expiry are profession-owned typed tasks on that clock. Mesmer
selects every exceptional cast through a stable-ID handler and stores scheduler-local controllers explicitly on its
context; it has no all-skills scheduling hook or module-level runtime registry. Scheduler and UI availability share pure
profession predicates. Mesmer does not own a scheduler, resolver wrapper, or result builder.

## Events

Event schema version 1 is defined in `platform/engine/events/events.ts`. Every event has:

```js
{
  type,
  at,
  source,
  sourceId,
  actorType, // "player", "summon", "effect", or "unknown"
  activationId, // one cast or triggered-effect activation
  weaponStrengthProfileId, // coefficient-based strike profile snapshot
}
```

`source` is a display/origin label and must not drive combat behavior. Player-only sigils, relics, and traits use
`actorType`. The resolver retains a legacy source-label fallback for older scheduled streams.

Common types are `action`, `damage`, `condition`, `condition_tick`, `control`, `blind`, `weapon_set`, and `proc`. A
profession adds a namespaced type such as `example.resource` by registering it in `resolverHooks.eventHandlers`.
Duplicate registrations, missing required handlers, and unknown namespaced events throw explicit errors.

Standard event types are owned by `platform/gw2/resolver`. A profession reacts to them through
`resolverHooks.eventReactions` without replacing the common handler:

```js
resolverHooks: {
  eventHandlers: {
    "example.resource": handleResource,
  },
  eventReactions: {
    damage: handleProfessionCriticalTraits,
    control: handleProfessionInterruptTraits,
  },
}
```

Common handlers resolve damage and conditions, drain the queue, enforce combat and target-death bounds, and apply sigils
and relics. Reactions receive the resolved context plus capabilities such as `hitContext` and `applyCondition`. For
example, Ineptitude is a Mesmer `control`/`blind` reaction; control relics and control-triggered sigils remain common
GW2 behavior.

Critical-hit sigils retain expected-critical accumulation in deterministic mode. In stochastic mode the chronological
scheduler samples one critical outcome, stores it as `didCrit` on the canonical damage event, and uses that same fact
for all ready on-critical sigils. The resolver consumes the stored fact for profession reactions without rolling again.
Critical strike damage remains expected-valued.

The scheduler assigns every cast a stable `activationId`; all direct, channeled, pulsing, and delayed packets from that
cast retain it. Triggered traits, sigils, relics, equipment effects, and summon attacks receive separate activation IDs.
The GW2 policy snapshots `weaponStrengthProfileId` from canonical skill metadata while the activation's weapon, kit,
transform, or shroud is still known.

`platform/gw2/weapon-strength.ts` owns immutable min/max profiles. The resolver uses their midpoint in deterministic
mode. In stochastic mode it draws one continuous uniform value per activation, caches it for every packet, and uses an
actor-scoped `weapon-strength:*` random stream independent from critical and trait streams. Resolved coefficient strikes
expose the activation, profile, resolved strength, and whether it was sampled. Explicit numeric strength, flat damage,
conditions, and independent summon formulas remain exempt.

## Skills, traits, and rotations

Behavior uses stable IDs. A canonical catalog merges generated metadata, simulator mechanics, explicit overrides, and
extra skills. Callable `skillHandlers` are registered by handler ID and dispatched by the profession contract.
Validation rejects duplicate skill IDs, missing callable handlers or parent skills, invalid effects, invalid slots, and
unavailable weapon metadata. Canonical catalogs may also carry validated trait and specialization metadata. Resolver
behavior looks skills up by `skillId`; display-name lookup is retained only for legacy streams and application-boundary
rotation migration.

All native profession skill mechanics use one timing contract:

- `castTimeMs` is the base action duration. A skill may instead provide only `quicknessCastTimeMs`; catalog assembly
  derives the base duration with the 1.5 action-rate multiplier. When neither a measured Quickness duration nor
  `unaffectedByQuickness` is present, the GW2 policy applies action-rate scaling and 40 ms quantization at runtime.
- `unaffectedByQuickness` marks casts whose duration and cast-scaled effect timing do not change under Quickness.
- `cooldown` is the canonical skill cooldown, `ammoRecharge` is the per-charge timer, and `ammoCastLockout` is the
  minimum delay between consecutive ammo casts. Imported API `recharge` values are normalized at profession catalog
  boundaries rather than retained on canonical Warrior skills.
- `rechargeAnchor` is optional and defaults to `castEnd`; `castStart` supports actions whose recharge begins before a
  modeled aftercast ends.
- `lockouts` optionally declares skill-family availability windows as `{ group, durationMs }`. Activating the skill
  blocks only other skills that declare the same group; unrelated actions, cast timing, effects, and cooldowns are
  unchanged.
- explicitly timed effects declare `timingAnchor: "castStart" | "castEnd"` and `timingScale: "cast" | "fixed"`;
- evenly spaced effects use `atMs` plus optional `intervalMs`; irregular exact packets use chronological `ticks`, with
  coefficient data on each strike tick;
- all `*Ms` values are milliseconds. Legacy `activation`, `castTime`, `packetOffsets`, `atMsList`, inferred cast
  scaling, and special cast-end offset fields are rejected at catalog assembly.

Shared weapon data derives midpoint compatibility values from canonical weapon-strength profiles and owns broad
capabilities. Each canonical profession catalog owns exact `weaponHands` metadata. Application adapters derive their
weapon selector data by combining those two sources.

Normalized rotations use:

```js
{ type: "cast", skillId }
{ type: "wait", durationMs }
{ type: "combat-start" }
{ type: "cast", skillId, concurrentOffsetMs: 100 }
{ type: "cast", skillId, interruptAfterMs: 500 }
{ type: "cast", skillId, releaseAtCharges: 3 }
```

Legacy display-name entries are converted at the application boundary. Concurrent and interrupted casts are scheduler
operations; their timing is decided before effects and cooldowns are scheduled.

Serial casts and shift-queued concurrent instants wait for finite cooldown, ammo, or profession availability, including
when a concurrent instant becomes ready after its parent cast ends. Permanent availability blocks are still invalid.
Once a queued command advances to its ready time, later rotation commands proceed from that chronological point. Cast
completion and typed tasks run chronologically, and availability is reevaluated after intermediate tasks.

`releaseAtCharges` is an optional positive-integer cast target used by charged skills. A profession may return retryable
availability until that target is reached. Omitting it leaves the target to profession policy, such as Bladesworn's
maximum-charge Dragon Slash release.

Declarative multi-hit effects emit one canonical damage event per hit. Optional hit intervals preserve channels and
persistent attacks, including effects that finish after their cast. The GW2 scheduler policy rejects weapon skills that
are not equipped on the active set, while allowing callers without equipment configuration to use isolated mechanic
fixtures.

## Builds

The current persisted schema is:

```js
{
  schemaVersion: 3,
  profession: "<registry id>",
  // profession build fields
}
```

Each profession owns defaults, explicit version migrations, and resource-specific normalization and validation. Native
professions configure the shared `platform/gw2/build-codec.ts` factory, which owns common schema migration,
sanitization, and validation for gear, weapons, sigils, relics, infusions, runes, consumables, specializations,
specialization-available slot skills, targets, and canonical rotation timing. The existing `gw2-mesmer-simulator-v2`
localStorage key is kept so saved builds migrate in place. Browser state uses a compatibility view of rotation entries;
storage and the simulator contract use normalized commands. Stored local data may fall back to defaults when unreadable,
while explicit user imports preserve wrong-profession and future-version errors.

## Included professions

- `mesmer`: native profession-contract implementation using the shared canonical generated/supplemental/mechanics
  catalog pipeline. Shared declarative scheduling owns ordinary effects; stable-ID handlers and namespaced tasks own
  clones, phantasms, shatters, instruments, Continuum Split, and Mirage behavior.
- `elementalist`: native shared-engine implementation for attunements, elementals, auras, overloads, Weaver dual
  attunement, Catalyst energy and spheres, and Evoker familiars and charges.
- `guardian`: declarative shared-engine implementation with a reproducible current API snapshot, an explicit supplement
  for API-omitted bundle skills, complete executable skill coverage, all specialization mechanics, Guardian trait rules,
  build validation, and a shared-shell browser application.
- `necromancer`: declarative shared-engine implementation with a reproducible API snapshot, API-omitted
  shroud/Lich/Ritualist supplements, life force, Reaper/Harbinger/Ritualist shrouds, Scourge shades, blight, minions,
  spirits, trait reactions, build validation, and a shared-shell application. Its stable definition exports a profession
  family: runtime catalogs, handlers, UI resources, and state contain Core plus at most one of Reaper, Scourge,
  Harbinger, or Ritualist. Elite weapon skills remain in Core because Weaponmaster Training makes them profession-wide.
- `engineer`: native shared-engine implementation for kits, tool-belt skills, Photon Forge heat, Mechanist commands, and
  Amalgam morph state.
- `revenant`: native shared-engine implementation for fixed legend bars, energy and upkeep, legend swaps, Vindicator
  dodges, and Conduit affinity. Its stable definition exports a profession family: runtime catalogs, handlers, hooks, UI
  resources, and state contain Core plus at most one of Herald, Renegade, Vindicator, or Conduit.
- `ranger`: native shared-engine implementation for pets, astral force, Soulbeast beastmode, Untamed unleash, and
  Galeshot mechanics.
- `warrior`: native shared-engine implementation for adrenaline and burst skills, Berserker rage, Bladesworn
  dragon-trigger charges, and Paragon mechanics.
- `thief`: native shared-engine implementation for initiative, stealth and revealed state, stolen skills, malice, Shadow
  Shroud, and Antiquary artifacts.

`js/app/profession/registry.ts` is the application roster source of truth; documentation must not maintain a separate
profession count.

## Adding another profession

1. Add `js/professions/<id>/` with a build codec, a Core module, owner-local elite modules, and a Core-first
   `defineNativeProfession()` composition. Each module contributes its own catalog data; export
   `assembleNativeApplicationCatalog(modules)` through the stable root catalog. Use `defineProfession()` only for an
   intentionally standalone architecture.
2. Register stable skill/trait IDs, namespaced custom event handlers, and only the standard event reactions the
   profession needs. Declare exact hand availability in `weaponHands` and register callable custom cast behavior in
   `skillHandlers`.
3. Add the profession page and one lazy entry to `js/app/profession/registry.ts`, providing `loadProfession` and
   `loadAppAdapter` loaders.
4. Add an end-to-end fixture that imports no other profession.
5. Run `npm test` and `npm run check`.

No engine, GW2, or shared UI branch should be needed. New professions should use the `platform/engine` scheduler,
canonical effects, shared effect materializer, and the `platform/gw2` resolver. If a new rule is truly shared by
multiple professions, add it to `platform/gw2`; otherwise keep it in the profession module as a scheduler mechanic or
resolver reaction.
