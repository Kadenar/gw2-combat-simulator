# Profession-neutral simulator architecture

How the simulator is composed, the contracts each layer exposes, and the workflow for adding a profession. See
[MODULES.md](./MODULES.md) for per-folder ownership and [SKILL-EVENT-ORDERING.md](./SKILL-EVENT-ORDERING.md) for
commands, internal tasks, and same-time combat ordering.

## Contents

- [Layers](#layers)
- [Native profession modules](#native-profession-modules)
- [Profession contract](#profession-contract)
- [Runtime and simulation](#runtime-and-simulation)
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
  browser/         game-neutral page entry, game boundary, host integration, and shell
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
- `js/browser` and `js/games/gw2/app` are the composition roots for neutral and GW2 browser concerns.

The shared shell receives a per-profession application adapter (build codec, storage key, runtime/config builder,
renderer hooks, filenames, specialization fallback, relic list, contribution worker). The registry-driven profession
selector switches between registered applications with independent persisted builds. Shared renderers consume profession
palette/resource view models; timeline, log, fixed-bar, resource, and palette behavior come from each profession's UI
definition. With ordinary weapon swaps, the palette shows both weapon sets but only enables the active one, so inactive
cooldowns stay inspectable.

## Native profession modules

Every profession is authored with `platform/profession-definition/profession.ts`. A module is a vertical slice declared
with `defineNativeModule()`:

| Section            | Owns                                                                           |
| ------------------ | ------------------------------------------------------------------------------ |
| `data`             | Generated identities, skill mechanics, traits, weapon hands, and chains        |
| `state`            | One `create` factory and optional detached public `project` projection         |
| `hooks`            | Availability, cast hooks, named tasks, resource policies, and combat reactions |
| `modifiers`        | Declarative formula rules and imperative modifier hooks                        |
| `attributes`       | Intrinsic mechanic and skill-passive attribute contributions                   |
| `traitDefinitions` | Trait-owned profiles, modifier rules, triggers, hooks, and build contributions |
| `presentation`     | UI contributions, optionally catalog-aware                                     |

TypeScript and native module validation reject unknown module fields and retired state sections.
`defineNativeProfession()` composes Core with the selected specialization and exposes `runtimeFor(config)`. There is one
mutable state instance per run.

`defineTrait()` definitions expand once in `defineNativeModule()`. Ordinary rules receive live trait-selection gates;
rules for already-created effects may opt out with `requiresSelection: false` and an explicit event predicate. Trait
triggers receive compiler selection gates; value callbacks retain explicit eligibility and admitted lifetime handlers
retain ownership and expiry. Trait hooks and module hooks share the same ordered composer, and build contributions enter
the existing attribute conversion pass. Patch previews consume expanded declarations.
[MODULES.md](./MODULES.md#profession-file-roles) describes where trait definitions and their supporting behavior live.

### Catalog assembly

`createNativeModuleData()` selects generated metadata for one owner and merges local mechanics.
`assembleNativeApplicationCatalog()` derives the full editor/build catalog from all modules; runtime fragments contain
Core plus only the selected elite. There is no separate ownership table. Assembly fails on duplicate IDs or weapon hands
and invalid specialization-only IDs. Weapon skills belong to Core (Weaponmaster Training) unless listed in
`specializationOnlySkillIds`.

### Build eligibility

`platform/builds/selected-skills.ts` (`isBuildSkillAvailable`) is the baseline gate: excluded skills are never
selectable or castable, weapon skills are shared across specializations, and other skills need their declared
specialization. Core installs it in runtime and palette availability for every profession; runtime rejection uses
`gw2.build-unavailable` and runs before profession state checks. Profession callbacks only add restrictions. Equipped
slots, weapon variants, resources, cooldowns, and dynamic state are separate checks.

### Source roles

Generated API metadata carries identity and presentation only, never coefficients or conditions. Skill files hold the
authoritative ID-keyed declarations and intrinsic skill behavior. Trait policies remain with their trait owners;
mechanics own shared state and hook files register those contributions. Tests compose cross-profession inventories under
`tests/`. Elementalist is a catalog-generation exception: its `data/module-data.ts` aggregates all five module-owned
skill inventories before partitioning them back into disjoint owners. That aggregate contains no separate source of
skill tuning, and ESLint permits only the module skill-index imports at that boundary. The full list of file roles is in
[MODULES.md](./MODULES.md#profession-file-roles).

### Authoring workflow

1. Author mechanics in the owning Core or elite directory.
2. Build `data` with `createNativeModuleData()`; declare the module with `defineNativeModule()`.
3. Add the module to the Core-first tuple and assemble with `assembleNativeApplicationCatalog()` in `catalog.ts`. Never
   hand-build runtime fragments.
4. Keep browser persistence and rendering in `app/app-definition`.

## Profession contract

Native professions expose identity, catalog, build and UI contracts, and `runtimeFor(config)`. The returned runtime owns
`createState`, `projectPlanningState`, availability/cast/recharge hooks, named tasks, custom event handlers, resource
policies, and stage-specific reactions. The application surface stays separate from execution.

Standalone test fixtures use `defineTestProfession({ id, name, catalog, resources: { createState }, hooks })` from
`tests/helpers/profession.js`. `defineProfession` supplies state factories, projections, and normalized modifiers;
executable policies belong in `hooks.resources` and `hooks.endurance`. Native runtime composition and the shared
execution entry validate policy declarations before use; live controllers validate their returned tuning and clocks.
Optional native hooks default to no-op or identity behavior. A module with only declarative skill data needs no hooks.

`resources.projectPlanningState` is one callback receiving the planning observation input, not an ordered hook list. An
absent callback or an `undefined` result uses the observer's detached profession-state fallback. Native module
projections compose before profession normalization.

- `planningState.availability` captures the composed runtime profession gate for each player-castable candidate and its
  default command. It is detached, excludes scheduler cooldown/lane checks, and is omitted from score runs. Retry times
  are absolute seconds for reevaluation, not guaranteed cast times. The palette reports startup as unevaluated and
  denies missing entries in completed observations.
- Optional `paletteOverride(context, skill)` separates shared-tile identity (`tileActive`), proven authoring insertion
  exceptions (`available`, `message`), and command-editor access (`editorAccess`). Core, elite, and family fields merge
  in that order; none bypass build eligibility.
- Event presenters return `{ type, description, className, order, flags }`; null hides an event and undefined delegates.

### Families

A family exposes immutable metadata and cached active-runtime composition. `runtimeFor(config)` selects Core plus the
active elite; missing or Core selects Core alone, and unknown elites throw. `resolveProfession(config)` supplies
normalized catalog and attribute metadata to application consumers; it does not create a second gameplay state.

- State shape: `{ core, specialization: { kind, state } }` — a plain object, no proxies. Core mechanics use `core`;
  elite mechanics validate and use only the active specialization state.
- `createProfessionFamilyUi()` is more lenient: an unknown/Core-trait-line/missing name selects Core. Lists compose Core
  then elite, palette overrides refine individual fields, presenters delegate on `undefined`, and selection replacement
  asks the elite first.
- Modifier rules: modules contribute inert `modifiers.modifierRules`. The family compiles Core + active elite once,
  preserving the single additive-damage bucket, including when the rule set is empty. Modules may declare
  `modifiers.damageBuckets` eligibility policies; each target (`strikeDamage` or `conditionDamage`) has at most one
  owner across the selected modules. Duplicate owners are rejected rather than merged.

`platform/combat/modifiers.ts` compiles per-effect scalar rules into critical chance/damage, strike damage, condition
damage, and condition duration hooks, combining equipment and profession additions once. Pet/mech owners exclude player
Force and Bursting. Damage hooks are compiled outputs, not authoring hooks; arbitrary compiler overrides and imperative
damage declarations are rejected. Trait and module `attributes` declarations provide owned attribute contributions.
Imperative non-damage hooks remain available for attributes, critical chance/damage, and condition base
duration/duration. Modifier declarations reject keys other than those hooks, `modifierRules`, and `damageBuckets`.

### Hook ownership

Cast acceptance reserves lane/resource/recharge decisions once. Successful casts apply `castCommit` side effects,
dispatch `onCastCommit` (including trait triggers), then schedule authored tasks. Committed interruptions receive the
same rewards as full casts; cancelled attempts dispatch only `onCastCancel` for cleanup. The `castCommit` task anchor
uses the actual cast end, while `castEnd` retains the reserved full end. Named tasks carry detached payloads on the
common heap. Resolved-hit, condition, boon, combo, and control reactions see the same live profession state as the next
command. Critical effects reuse the hit's actual outcome and claim one ICD; no scheduling prediction exists.

Skill costs are checked for affordability at acceptance and paid automatically at `castStart` (the default) or
`castCommit`. Successful completion pays committed costs before completion rewards, including page refunds. Firebrand
tome skills, including Scorched Aftermath, use `castCommit`; their field and damage timings do not control page payment.

## Runtime and simulation

`simulateGw2()` validates input and invokes `simulation/runtime.ts` exactly once.

That entry assembles per-run services. `simulation/coordinator.ts` owns the heap, logical clock, causal scope, and
advancement loop. `execution/cast-execution.ts` owns readiness, reservations, acceptance, commitment, and completion;
the rotation driver consumes commands through its operations. `resolver/effect-delivery.ts` owns admission, deferred
preparation, immediate condition settlement, target gates, and reaction settlement. `results/project-runtime.ts`
projects the settled run without advancing it.

The coordinator's single heap stores the union of resolver packets and internal work. Work retains its typed payload and
lifetime owner without public packet identity. The resolver receives only packet scheduling, cancellation, and current
ordering capabilities; dispatch, pending-work inspection, and owner cancellation stay with execution.

Mechanic contributions use the explicit `RuntimeHooks` surface in `profession-definition/runtime-hooks.ts`; unknown
fields and duplicate named handlers fail. Notification order, transform propagation, retry precedence, and policy
selection remain explicit. Module declarations, rule compilation, and hook composition use
`RuntimeHooks<State, TSkill>`; the broader `RuntimeProfession` contract belongs to the compiled profession, including
its catalog, state factory, weapon eligibility, attack-chain overrides, and planning projection.

Author callbacks receive capabilities from `profession-definition/runtime-context.ts` and
`profession-definition/mechanic-context.ts`: read-only selection/query views, combat mutation services, or lifecycle
services as appropriate. They do not receive the command cursor, heap, or report collections. Gameplay history in
`combat/history/executed-facts.ts` is independent of optional reports; pending work becomes history only when executed.
The [platform ownership guide](../../js/games/gw2/platform/README.md) documents these boundaries and service owners.

- One cursor, heap, profession/target state, resource controller, and RNG own the run.
- Pending work is invisible to historical queries until it executes.
- Score and detailed modes share mechanics. Detailed mode retains steps, reports, APM, and optional diagnostics.
- `planningState` captures resources, cooldowns, ammo, weapon set, and public profession state at the observation end.
  After target death, authored commands continue while hostile effects and hit-dependent grants are suppressed.
- The planning observation is deeply detached and is not a checkpoint. Combat reports stop at `combatEndTime`.
- Rotation duration follows accepted commands, reservations, and final input recovery. Rotation, tail, and absolute
  observation policies bound delayed work without recursively extending the rotation.
- Cast/interrupt commitment and lifetime generations determine whether pending work survives cancellation. Committed
  projectiles can outlive a cast. Finite actor tasks schedule bounded work, not an unbounded future history.
- Application builds always enable console Quickness and Alacrity. Player recharge uses a constant 1.25x rate, or 1.5x
  for Chronomancer player skills. Summon recharge integrates received Alacrity windows at 1.25x while active and 1x
  otherwise. Explicit Alacrity exemptions retain their base rate.
- Player health stays at 100%; target health remains live. Attribute preview health is a separate input.
- Build adapters provide attribute provenance so static rules apply once; dynamic modifiers always read live facts.

The event clock, ordering, programmatic API, and snapshot documents describe the precise boundary contracts.

## Events and resolution

Schema (version 1) lives in `platform/events/events.ts`:

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
- Common types are declared by `COMMON_EVENT_TYPES` in `events/events.ts`. Professions add namespaced types (e.g.
  `example.resource`) via `hooks.eventHandlers`; duplicates, missing handlers, and unknown namespaced events throw.
- Boon queries read executed phase-visible history and delegate stacking/lifetime arithmetic to `combat/boons.ts`.

`platform/resolver` owns standard types. Common handlers resolve damage and conditions; the runtime owns queue draining
and combat/death gates. Professions react to named stages (listed in `platform/resolver/reaction-registry.ts`; bare
names like `damage` are rejected). Only `damage.resolving` returns packet patches: each handler sees earlier patches,
and the merged result is applied before hit resolution. Every other stage is a void notification; returned objects are
discarded and subsequent handlers receive the original event. Module composition and the resolver registry use the same
stage rules, preserving their established handler order.

Reaction details include resolved facts such as `hitContext`; producers submit effects through `runtime.effects.emit`.
Conditions that must become visible within the current reaction use a packet request with `settlement: 'reaction'` at
the live clock:

```js
hooks: {
  eventHandlers: { "example.resource": handleResource },
  reactions: {
    "damage.resolved": handleProfessionCriticalTraits,
    "control.resolved": handleProfessionInterruptTraits,
  },
}
```

**Chance-based effects.** Both outputs use the same seeded streams. An eligible resolved hit samples its critical
outcome once; suppressed impacts make no draw or claim. Sigils and traits reuse the hit's outcome for critical
eligibility, then roll any separate proc chance. Combo attempts and Shrapnel also use seeded rolls rather than
accumulation. Deterministic damage defaults to the expected critical multiplier, with an optional rolled policy.
Stochastic runs always use the same `didCrit` outcome for damage, proc eligibility, and reporting. Averaged hit details
label the distinction between proc outcomes and averaged damage.

**Activations and weapon strength.** Each cast gets a stable `activationId` shared by all its packets; triggered traits,
sigils, relics, equipment, and summons get their own. `weaponStrengthProfileId` is snapshotted while the
weapon/kit/transform/shroud is known. `platform/equipment/weapons/strength.ts` owns min/max profiles: deterministic uses
the midpoint; stochastic draws one uniform value per activation from an actor-scoped `weapon-strength:*` stream.
Explicit numeric strength, flat damage, conditions, and profile-less summon formulas are exempt.

## Skills and rotations

Behavior keys on stable IDs. The catalog merges generated metadata, mechanics, overrides, and extra skills, then rejects
duplicate IDs, unknown skill fields, missing parents or variant profiles, invalid effects or slots, and unavailable
weapon metadata. Imperative behavior lives in module hooks, not in the catalog. Display-name lookup is used only when
normalizing rotation input that names skills (see [Rotation commands](#rotation-commands)). Profession catalogs own
exact `weaponHands`; shared weapon data owns broad capabilities; app adapters combine both.

Skills and balance profiles are open records today, so field names are checked by runtime lists rather than types.

### Timing contract

- Player `castTimeMs` is effective duration **calibrated with permanent Quickness**; the runtime never rescales it for
  boons. Runtime variants may change it.
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
{ type: "cooldown-reset" }
{ type: "cast", skillId, concurrentOffsetMs: 100 }
{ type: "cast", skillId, interruptAfterMs: 500 }
{ type: "cast", skillId, releaseAtCharges: 3 }
```

`platform/execution/rotation.ts` normalizes every rotation input to these commands. It also accepts the documented
shorthand (a numeric skill ID or a skill-name string; see [PROGRAMMATIC-SIMULATION.md](./PROGRAMMATIC-SIMULATION.md))
Saved presets use canonical `{ type, skillId }` commands.

- Concurrent and interrupted timing is decided before effects and cooldowns are scheduled.
- Serial casts and queued concurrent instants wait for finite cooldown, ammo, or profession availability; permanent
  blocks are invalid. Later commands continue from the ready time, and availability is re-evaluated after intermediate
  tasks.
- `releaseAtCharges` lets a profession return retryable availability until the charge target; omitted, profession policy
  decides (e.g. Bladesworn Dragon Slash releases at max).

## Builds and attributes

Each profession versions its own schema; read the `*BUILD_SCHEMA_VERSION` constant in its `build/build.ts`:

```js
{
  schemaVersion: 3, // use this profession's current schema version
  profession: "<registry id>",
  // profession build fields
}
```

Professions own defaults, profession-specific fields and normalization, and resource validation. The shared
`platform/builds/codec.ts` factory handles common normalization and validation (gear, weapons, sigils, relics,
infusions, runes, consumables, specializations, slot skills, targets, rotation timing). Its `migrateBuild()` accepts
older schema versions, but no profession registers a version migration, so older builds are simply renumbered and
normalized. `toApplicationBuild()` additionally turns on console Quickness and Alacrity. Storage and the simulator use
normalized commands. Unreadable local data falls back to defaults; explicit imports surface wrong-profession and
future-version errors.

`platform/builds/attributes.ts` owns attribute assembly: `calculateCommonAttributes()` handles equipment, consumables,
infusions, sigils, and base derived stats; professions pass their trait/skill deltas to `finalizeBuildAttributes()`,
which recomputes crit chance, crit damage, boon duration, and condition duration.

Canonical build calculation lives in `build-context/`, outside the application and platform layers. A profession's
`build/context.ts` exports `createBuildContext({ build, patchId, transitionDelays, disabledModifier? })` and the bound
profession. `attributes(1 | 2)` caches each requested set; `simulationConfig()` reuses those calculations and returns
independent equipment seeds and configuration. Callers create a new context after changing any input. Selection uses the
build's starting state, including Revenant's starting legend. Displayed weapon sets and previous results do not
participate. Optimizer workers and benchmark requests use the same headless binding as the workspace.

Each binding supplies a pure skill-loadout resolver and profession assumption definitions directly. Build context never
reads `profession.ui`: starting-bar skills feed attributes, while every selected bar retains its slot positions in the
input-tracing configuration. Fixed-loadout presentation builds selectors and labels from the same resolved bar facts.
The build codec and simulation configuration share the composition of profession and common assumption defaults.

## Included professions

`js/games/gw2/profession-registry.ts` is the roster source of truth. The [profession guides](../professions/) describe
each family's supported mechanics and implementation owners.

## Adding another profession

1. Create `js/games/gw2/professions/<id>/` with a build codec, a Core module, owner-local elite modules, and a
   Core-first `defineNativeProfession()` composition exporting `assembleNativeApplicationCatalog(modules)` from
   `catalog.ts`.
2. Register stable skill/trait IDs, namespaced event handlers, needed standard reactions, and `weaponHands`.
3. Add the page and a lazy `loadProfession`/`loadAppAdapter` entry to `js/games/gw2/profession-registry.ts`.
4. Add an end-to-end fixture that imports no other profession.
5. Run `npm run check`.

No engine, platform, or shared UI branches should be needed. Put a rule in `js/games/gw2/platform` only if multiple
professions truly share it; otherwise keep it in the profession as a module hook or combat reaction.
