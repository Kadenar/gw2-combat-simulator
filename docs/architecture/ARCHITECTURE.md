# Profession-neutral simulator architecture

How the simulator is composed, the contracts each layer exposes, and the workflow for adding a profession. See
[MODULES.md](./MODULES.md) for per-folder ownership and [SKILL-EVENT-ORDERING.md](./SKILL-EVENT-ORDERING.md) for
rotation, scheduler-task, and same-time resolver ordering.

## Contents

- [Layers](#layers)
- [Native profession modules](#native-profession-modules)
- [Profession contract](#profession-contract)
- [Scheduler and simulation](#scheduler-and-simulation)
- [Events and resolution](#events-and-resolution)
- [Skills and rotations](#skills-and-rotations)
- [Builds and attributes](#builds-and-attributes)
- [Included professions](#included-professions)
- [Adding another profession](#adding-another-profession)

## Layers

```text
js/
  kernel/          game-neutral clock, events, queues, randomness, observation
  ui/              game-neutral view models and DOM/rotation primitives
  app/             game-neutral page entry, game boundary, host integration, and shell
  games/gw2/
    platform/      shared GW2 engine, combat, builds, equipment, and simulation
    professions/   profession-owned builds, skills, state, mechanics, and UI
    app/           GW2 browser composition, persistence, and presentation
    integrations/  logs, keybinds, and patch-preview adapters
```

Dependency rules (enforced by `eslint.config.js`, `tests/architecture/`, and
`tests/games/gw2/platform/migration-and-boundaries.test.js`):

- `js/kernel` imports no GW2, UI, application, or profession modules.
- `js/ui` consumes game-neutral contracts only.
- `js/games/gw2/platform` may import `js/kernel`, but no profession or application modules.
- Profession runtimes may import the kernel and platform; profession `app/` adapters may also import GW2 app modules.
- `js/app` and `js/games/gw2/app` are the composition roots for neutral and GW2 browser concerns.

The shared shell receives a per-profession application adapter (build codec, storage key, runtime/config builder,
renderer hooks, filenames, specialization fallback, relic list, contribution worker). The registry-driven profession
selector switches between registered applications with independent persisted builds. Shared renderers consume
profession palette/resource view models; timeline, log, fixed-bar, resource, and palette behavior come from each
profession's UI definition. With ordinary weapon swaps, the palette shows both weapon sets but only enables the active
one, so inactive cooldowns stay inspectable.

## Native profession modules

Every profession is authored with `platform/profession-definition/profession.ts`. A module is a vertical slice declared
with `defineNativeModule()`:

| Section                | Owns                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| `data`                 | generated identities, skill mechanics/overrides, extra skills, traits, weapon hands, chains |
| `state`                | `scheduler` factory; optional distinct `resolver` factory and public `project` projection  |
| `mechanics.execution`  | skill handlers, availability, cast lifecycle, cast rules, scheduler hooks                  |
| `mechanics.resolution` | resolved-event reactions and resolver hooks                                                |
| `mechanics.modifiers`  | declarative modifier rules, compiled into the right phase                                  |
| `presentation`         | UI contributions; may be a catalog-aware factory                                           |

TypeScript checks section placement. At runtime `defineNativeModule()` validates IDs, required data/state, factories,
and handler/reaction phases, but **silently ignores unknown or retired flat fields** — they register nothing.

`defineNativeProfession()` takes a Core-first module tuple, infers the state union and specialization IDs, and compiles
to the engine's `defineProfessionFamily()` contract, which remains the execution boundary.

### Catalog assembly

`createNativeModuleData()` selects generated metadata for one owner and merges local mechanics.
`assembleNativeApplicationCatalog()` derives the full editor/build catalog from all modules; runtime fragments contain
Core plus only the selected elite. There is no separate ownership table. Assembly fails on duplicate IDs, handlers, or
weapon hands, unused handlers, handlers in the wrong slice, and invalid specialization-only IDs. Weapon skills belong to
Core (Weaponmaster Training) unless listed in `specializationOnlySkillIds`.

### Build eligibility

`platform/builds/skill-eligibility.ts` is the baseline gate: excluded skills are never selectable or castable, weapon
skills are shared across specializations, and other skills need their declared specialization. Core installs it in
runtime and palette availability for every profession; runtime rejection uses `gw2.build-unavailable` and runs before
profession state checks. Profession callbacks only add restrictions. Equipped slots, weapon variants, resources,
cooldowns, and dynamic state are separate checks.

### Source roles

- `data/<profession>-api-metadata.ts` — generated identity/presentation metadata; never coefficients or conditions.
- `data/<profession>-supplemental-skills.ts` — identity/presentation for skills missing from the API snapshot.
- `data/traits-data.ts` — the only export of flattened runtime `TRAITS`.
- `data/module-data.ts` — generated metadata, catalog transforms, and module data selector options.
- Core/specialization `skills.ts` or `skills/*.ts` — authoritative ID-keyed declarative skill fields. No
  production-wide skill aggregate; tests compose inventories under `tests/`.
- `mechanics/*.ts` (or `mechanics.ts`) — owner-local, concept-named triggered effects and state machines.
- `execution/` — `augmentSkill()`/`replaceSkill()` strategies for behavior declarative effects can't express.
- `catalog.ts` — module tuple and assembled catalog, re-exported by `profession.ts`. Only `build/` imports it directly.

### Authoring workflow

1. Author mechanics in the owning Core or elite directory.
2. Build `data` with `createNativeModuleData()`; declare the module with `defineNativeModule()`.
3. Add the module to the Core-first tuple and assemble with `assembleNativeApplicationCatalog()` in `catalog.ts`. Never
   hand-build runtime fragments.
4. Keep browser persistence and rendering in `app/app-definition`.

## Profession contract

The engine-level contract, produced by native composition or written directly with `defineProfession()` (standalone
architectures and test fixtures):

```js
export const exampleProfession = defineProfession({
  id: 'example',
  name: 'Example',
  catalog,
  build: { createBuildDefaults, migrateBuild, validateBuild },
  resources: {
    createProfessionState,
    createResolverState, // optional clean resolver-time initial state
    projectPlanningState // optional public profession-state projection
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
    paletteSkillAvailability, // { available, message, retryAt? }
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

- All hooks are optional: missing validation accepts, missing modifiers return input, others no-op.
- Scheduler hooks and resolver reactions take `{ id, order, handler }`; lower order first, declaration order breaks ties.
- `paletteSkillAvailability(context, skill)` is normalized to `{ available, message, retryAt? }` (`message` defaults to
  `''`; `retryAt` is absolute simulator seconds). Omitted means always available.
- Event presenters return `{ type, description, className, order, flags }`; `null` hides an event, `undefined` falls
  back to the diagnostic row.

### Families

A family exposes identity, full catalog, build codec, normalized UI, optional refinement, and `resolveRuntime(config)`
— never handlers, hooks, or mutable state. `resolveRuntime` returns a cached runtime of Core plus the selected elite;
missing or `Core` selects Core alone, unknown elites throw. `simulateGw2()` and the scheduler normalize families; plain
`defineProfession()` contracts pass through.

- State shape: `{ core, specialization: { kind, state } }` — a plain object, no proxies. Core mechanics use `core`;
  elite mechanics validate and use only the active specialization state.
- `createProfessionFamilyUi()` is more lenient: an unknown/Core-trait-line/missing name selects Core. Lists compose Core
  then elite, availability callbacks may veto, presenters delegate on `undefined`, and selection replacement asks the
  elite first.
- Modifier rules: modules contribute inert `attributeRules.modifierRules`; exactly one module supplies
  `compileModifierRules`, and the family compiles Core + active elite once, preserving the single additive-damage
  bucket.

`platform/combat/modifiers.ts` compiles per-effect scalar rules into critical chance/damage, strike damage, condition
damage, and condition duration hooks, combining equipment and profession additions once. Pet/mech owners exclude player
Force and Bursting. Ordered attribute conversions stay imperative hooks.

### Phase-explicit helpers

| Phase          | Helpers                                                                                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scheduler      | `skillAvailability()`, `afterSkillEffects()`                                                                                                                   |
| Resolver       | `onResolvingDamage()`, `onResolvedDamage()`, `onResolvedControl()`, `onResolvedBlind()`, `onConditionApplied()`, `onBuffApplied()`, `onComboResolved()`, `onAuraApplied()` |
| Critical procs | `onResolvedCriticalHit()` (eligibility, state, materialization, ICD, attribution, effect)                                                                      |
| Skill handlers | `augmentSkill()` decorates declarative effects; `replaceSkill()` owns emission                                                                                 |

Helpers need stable IDs, accept explicit order, and compile into existing cast rules, hooks, or reactions. A replacing
handler keeps `effects` as canonical profile metadata; the scheduler does not emit them.

`advanceCriticalProc()` is the shared critical-proc kernel, used by `onResolvedCriticalHit()` and by scheduler-side
`advanceScheduledCriticalProc()`. Both consume the same sampled hit in stochastic mode and share threshold progress,
weighting, secondary rolls, tolerance, and ICDs. Discrete declarations apply every returned proc; weighted ones apply
fractional quantities.

Raw `mechanics.execution.castRules`/`hooks`, `mechanics.resolution.hooks`, and raw modifier hook bundles remain escape
hatches for typed tasks, custom events, complex cooldown/ammo policy, and multi-event state machines. Keep them
owner-local and never import inactive specialization code.

## Scheduler and simulation

`simulateGw2()` is the single entry point: shared scheduler → event stream → resolver → result builder.

- **State.** Shared scheduler state holds time, cooldowns, ammo, lockouts, active weapon set, skill uses, and
  `profession` (`.core` / `.specialization.state`); context owns pending events and tasks. Typed tasks carry
  serializable payloads to namespaced profession handlers.
- **Policy.** The platform supplies Quickness-adjusted casts, Alacrity-adjusted recharge, ammo, and starting weapon
  set; profession hooks may modify cast duration, recharge, or max ammo.
- **Result state.** `planningState` contains scheduler-only cooldowns, ammo, weapon set, and the allowlisted
  `planningState.profession` from `resources.projectPlanningState`. `combatState.profession` contains resolved
  event state. Each projection carries `atSeconds`; planning can extend past target death. Public results expose
  `rotationEndTime`, `observationEndTime`, and `combatEndTime` in seconds. Editor insertion previews use planned
  state without an observation tail. Scheduler snapshots remain an internal contract, not resumable checkpoints.
- **Observation.** Callers choose `rotation`, `tail`, or absolute policies. The scheduler derives rotation end from
  commands and cast-lane reservations only, then drains finite tasks to the observation end. The resolver applies
  target-death clipping and uses one effective end everywhere. Skill/event metadata and saved benchmark metadata cannot
  change the boundary; benchmark tooling uses the default.
- **Interrupts and persistence.** `persistsAfterInterrupt` only controls packet cancellation. Persistent effects declare
  (or inherit) a positive `interruptCommitMs`; per-packet skills use `interruptMode: 'per-packet'`. Persistent actors
  use typed tasks with explicit generation/lifetime/stop conditions and schedule one bounded unit at a time.
- **Refinement.** `simulation.refineSchedulerConfig(config, result)` returns a new config to rerun or `null`/`undefined`
  when converged, up to `MAX_SCHEDULER_REFINEMENT_PASSES` (5). It must not mutate inputs or return the same object, and
  must be idempotent on converged results.
- **Attribute provenance.** Browser adapters pass `attributeProvenance` (`professionStaticRulesApplied`,
  `calculatedWeaponSet`, `calculatedPrimaryWeapon`) so static profession rules apply once; direct callers omit it and
  runtime hooks apply them. Weapon-dependent rules compare against the active weapon after swaps; dynamic combat
  modifiers are always runtime.

## Events and resolution

Schema (version 1) lives in `platform/engine/events/events.ts`:

```js
{
  type,
  at,
  source,
  sourceId,
  actorType, // "player", "summon", "effect", "environment", or "unknown"
  activationId, // optional identity for one cast or triggered-effect activation
  weaponStrengthProfileId, // optional coefficient-based strike profile snapshot
}
```

- `source` is a display label only. Behavior keys on `actorType` (optionally `ownerActorType` for inherited outgoing
  modifiers); validation requires explicit ownership, no source-label fallback.
- Common types (`COMMON_EVENT_TYPES`): `action`, `damage`, `condition`, `condition_tick`, `control`, `blind`,
  `weapon_set`, `proc`. Professions add namespaced types (e.g. `example.resource`) via `resolverHooks.eventHandlers`;
  duplicates, missing handlers, and unknown namespaced events throw.
- Boon queries select phase-visible history, then delegate to `combat/boons.ts`. Scheduler and resolver histories stay
  separate.

`platform/resolver` owns standard types. Common handlers resolve damage/conditions, drain the queue, enforce combat and
target-death bounds, and apply sigils and relics. Professions react to named stages (listed in
`platform/resolver/reaction-registry.ts`; bare names like `damage` are rejected) and receive capabilities such as
`hitContext` and `applyCondition`:

```js
resolverHooks: {
  eventHandlers: { "example.resource": handleResource },
  eventReactions: {
    "damage.resolved": handleProfessionCriticalTraits,
    "control.resolved": handleProfessionInterruptTraits,
  },
}
```

**Critical hits.** Deterministic mode accumulates expected crits. Stochastic mode samples one outcome in the scheduler,
stores it as `didCrit` on the damage event, and reuses it for sigils and resolver reactions. Crit damage stays
expected-valued.

**Activations and weapon strength.** Each cast gets a stable `activationId` shared by all its packets; triggered
traits, sigils, relics, equipment, and summons get their own. `weaponStrengthProfileId` is snapshotted while the
weapon/kit/transform/shroud is known. `platform/equipment/weapons/strength.ts` owns min/max profiles: deterministic uses
the midpoint; stochastic draws one uniform value per activation from an actor-scoped `weapon-strength:*` stream.
Explicit numeric strength, flat damage, conditions, and profile-less summon formulas are exempt.

## Skills and rotations

Behavior keys on stable IDs. The catalog merges generated metadata, mechanics, overrides, and extra skills; callable
`skillHandlers` are dispatched by handler ID. Validation rejects duplicate IDs, missing handlers/parents, invalid
effects or slots, and unavailable weapon metadata. Display-name lookup exists only for legacy streams and rotation
migration at the application boundary. Profession catalogs own exact `weaponHands`; shared weapon data owns broad
capabilities; app adapters combine both.

### Timing contract

- Player `castTimeMs` is effective duration **calibrated with permanent Quickness**; the scheduler never rescales it
  for boons. Runtime variants may change it.
- Independent summons keep base `castTimeMs`, optional `quicknessCastTimeMs`, Quickness rate conversion, and 40 ms
  rounding. Autonomous summons use profession-owned timing.
- `cooldown` is the skill cooldown, `ammoRecharge` the per-charge timer, `ammoCastLockout` the min gap between ammo
  casts. API `recharge` is normalized away at catalog boundaries.
- `rechargeAnchor`: `castEnd` (default) or `castStart`.
- `lockouts: [{ group, durationMs }]` blocks only other skills in the same group.
- Timed effects declare `timingAnchor: "castStart" | "castEnd"` and `timingScale: "cast" | "fixed"`. Even spacing uses
  `atMs` + `intervalMs`; irregular packets use chronological `ticks` with per-tick coefficients.
- All `*Ms` fields are milliseconds. Legacy `activation`, `castTime`, `packetOffsets`, `atMsList`, and inferred scaling
  fields are rejected.

Declarative multi-hit effects emit one damage event per hit and may outlast the cast. The GW2 policy rejects weapon
skills not on the active set unless the caller supplies no equipment config (mechanic fixtures).

### Rotation commands

```js
{ type: "cast", skillId }
{ type: "wait", durationMs }
{ type: "combat-start" }
{ type: "cast", skillId, concurrentOffsetMs: 100 }
{ type: "cast", skillId, interruptAfterMs: 500 }
{ type: "cast", skillId, releaseAtCharges: 3 }
```

- Concurrent and interrupted timing is decided before effects and cooldowns are scheduled.
- Serial casts and queued concurrent instants wait for finite cooldown, ammo, or profession availability; permanent
  blocks are invalid. Later commands continue from the ready time, and availability is re-evaluated after intermediate
  tasks.
- `releaseAtCharges` lets a profession return retryable availability until the charge target; omitted, profession
  policy decides (e.g. Bladesworn Dragon Slash releases at max).

## Builds and attributes

Each profession versions its own schema; read the `*BUILD_SCHEMA_VERSION` constant in its `build/build.ts` (currently 4 for
Elementalist and Ranger, 3 elsewhere):

```js
{
  schemaVersion: 3, // use this profession's current schema version
  profession: "<registry id>",
  // profession build fields
}
```

Professions own defaults, version migrations, and resource validation. The shared `platform/builds/codec.ts` factory
handles common migration, sanitization, and validation (gear, weapons, sigils, relics, infusions, runes, consumables,
specializations, slot skills, targets, rotation timing). Storage and the simulator use normalized commands; browser
state uses a compatibility view. Unreadable local data falls back to defaults; explicit imports surface
wrong-profession and future-version errors.

`platform/builds/attributes.ts` owns attribute assembly: `calculateCommonAttributes()` handles equipment, consumables,
infusions, sigils, and base derived stats; professions pass their trait/skill deltas to `finalizeBuildAttributes()`,
which recomputes crit chance, crit damage, boon duration, and condition duration.

## Included professions

`js/games/gw2/app/profession-registry.ts` is the roster source of truth.

| Profession   | Signature mechanics                                                                    |
| ------------ | -------------------------------------------------------------------------------------- |
| Elementalist | attunements, elementals, auras, overloads, Weaver, Catalyst spheres, Evoker familiars  |
| Engineer     | kits, tool belt, Photon Forge heat, Mechanist commands, Amalgam morphs                  |
| Guardian     | API-omitted bundle skills, trait rules, specialization mechanics                       |
| Mesmer       | clones, phantasms, shatters, instruments, Continuum Split, Mirage                      |
| Necromancer  | life force, Reaper/Harbinger/Ritualist shrouds, Scourge shades, blight, minions, spirits |
| Ranger       | pets, astral force, Soulbeast, Untamed, Galeshot                                       |
| Revenant     | legend bars, energy/upkeep, legend swaps, Vindicator dodges, Conduit affinity          |
| Thief        | initiative, stealth/revealed, stolen skills, malice, Shadow Shroud, Antiquary          |
| Warrior      | adrenaline/bursts, Berserker rage, Bladesworn charges, Paragon                         |

## Adding another profession

1. Create `js/games/gw2/professions/<id>/` with a build codec, a Core module, owner-local elite modules, and a
   Core-first `defineNativeProfession()` composition exporting `assembleNativeApplicationCatalog(modules)` from
   `catalog.ts`.
2. Register stable skill/trait IDs, namespaced event handlers, needed standard reactions, `weaponHands`, and
   `skillHandlers`.
3. Add the page and a lazy `loadProfession`/`loadAppAdapter` entry to `js/games/gw2/app/profession-registry.ts`.
4. Add an end-to-end fixture that imports no other profession.
5. Run `npm run check`.

No engine, platform, or shared UI branches should be needed. Put a rule in `js/games/gw2/platform` only if multiple
professions truly share it; otherwise keep it in the profession as a scheduler mechanic or resolver reaction.
