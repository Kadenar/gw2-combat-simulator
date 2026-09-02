# Simulator modules

This document is a **code ownership guide** for the Guild Wars 2 combat simulator.

Use it when you know what you want to change but are unsure **which module or directory should own that change**.

For the reasoning behind the architecture, simulation phases, dependency rules, and profession contracts, see
[ARCHITECTURE.md](./ARCHITECTURE.md).

## Repository map

| Path                                  | Purpose                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| `js/kernel/`                          | Game-neutral clock, collections, randomness, event-stream, queue, and observation contracts |
| `js/ui/`                              | Game-neutral view models, React mounting, and reusable UI/rotation primitives               |
| `js/app/`                             | Game-neutral registry, bootstrap, worker harness, and shell                                 |
| `js/games/gw2/platform/`              | Shared Guild Wars 2 formulas, resolver logic, data, gear, relics, and simulation engine     |
| `js/games/gw2/content/professions/`   | Profession-owned builds, skills, state, mechanics, traits, resolver behavior, and UI        |
| `js/games/gw2/app/`                   | GW2 build editor, rotation workspace, browser lifecycle, and presentation adapters          |
| `js/games/gw2/integrations/logs/`     | EVTC and dps.report parsing and rotation reconstruction                                     |
| `js/games/gw2/integrations/keybinds/` | Optional GW2 keybind import                                                                 |
| `js/games/gw2/integrations/patches/`  | Patch-preview manifest, authoring model, and optional browser UI                            |
| `data/games.json`                     | Runtime game-data roots and compatibility aliases                                           |
| `data/gw2/builds/`                    | Saved GW2 build presets                                                                     |
| `data/gw2/rotations/`                 | Saved GW2 rotation presets                                                                  |
| `tests/`                              | Unit, integration, architecture, browser, and regression tests                              |
| `scripts/`                            | Build, data generation, analysis, audit, and authoring tools                                |

At a high level:

```text
build + rotation
      ↓
profession application/runtime
      ↓
simulateGw2()
      ↓
scheduler
      ↓
scheduled event stream
      ↓
resolver
      ↓
simulation result
      ↓
shared application views
```

---

# Where should my change go?

Use this table as the first place to look.

| You're adding or changing...                                          | Usually belongs in...                                 |
| --------------------------------------------------------------------- | ----------------------------------------------------- |
| Skill coefficient, hit count, condition, boon, timing, cooldown, etc. | Owning `skills/index.ts` or `skills/<group>.ts`       |
| Shared mechanic data used by several skills                           | Profession `profiles.ts`                              |
| Profession runtime resource or state                                  | `state.ts` or `state/<concept>.ts`                    |
| Skill availability rule                                               | The owning skill or mechanic module                   |
| Resource gain/spend/regeneration                                      | `mechanics/<resource>.ts`                             |
| Cast lifecycle behavior                                               | The owning skill, trait, or mechanic module           |
| Declarative trait modifier                                            | `traits/modifiers.ts` or `traits/<trait-line>.ts`     |
| Complex trait proc or imperative behavior                             | `traits/index.ts` or `traits/<trait-line>.ts`         |
| Scheduler-specific skill implementation                               | The owning skill module; a focused handler if shared  |
| Custom scheduled event definitions                                    | `events.ts` or mechanic-specific file                 |
| Resolver reaction or custom resolved event                            | The owning concept module, exposed under `resolution` |
| Profession UI, palette, skill-bar, or active-state display            | `presentation.ts` or a domain-only `ui/` module       |
| Shared code used by several files within one profession               | `shared.ts`                                           |
| New reusable GW2 mechanic                                             | `js/games/gw2/platform/`                              |
| Generic scheduling primitive unrelated to GW2                         | `js/kernel/`                                          |
| Game-neutral browser shell behavior                                   | `js/app/`                                             |
| GW2 browser behavior                                                  | `js/games/gw2/app/`                                   |
| Shared presentation/view-model behavior                               | `js/ui/`                                              |
| Source-neutral log reconstruction within the GW2 integration          | `js/games/gw2/integrations/logs/lib/`                 |
| EVTC parsing or evidence inference                                    | `js/games/gw2/integrations/logs/evtc/`                |
| dps.report / Elite Insights parsing or inference                      | `js/games/gw2/integrations/logs/dps-report/`          |
| Upcoming balance changes                                              | Patch-preview system                                  |
| Build migration/default/validation                                    | Profession `build/build.ts`                           |
| New profession page/registry entry                                    | `js/games/gw2/app/profession/registry.ts`             |

The main rule is:

> Put behavior with the layer that owns the underlying game concept.

Do not move profession-specific mechanics into shared platform code simply because multiple files need them. Likewise,
do not duplicate shared GW2 behavior inside individual professions.

---

# Application layer

```text
js/app/
```

`js/app/` owns the game-neutral registry, bootstrap, worker harness, and shell. Game-specific browser behavior belongs
under its game package; GW2 uses `js/games/gw2/app/`.

## Main application files

| Module                              | Responsibility                                          |
| ----------------------------------- | ------------------------------------------------------- |
| `app.ts`                            | Browser entry point                                     |
| `bootstrap.ts`                      | Resolves the active game and content and starts its app |
| `game/registry.ts`                  | Validates and resolves game plug-ins                    |
| `simulation/game-worker-harness.ts` | Routes worker requests by game and content              |
| `shell/`                            | Neutral result contracts and workspace mounting         |
| `embed.ts`                          | Embedded simulator entry/support                        |

`js/games/gw2/app/profession-app.ts` coordinates the current GW2 browser application.

---

## Shared profession application composition

Shared profession application composition spans `js/games/gw2/app/` and its `profession/` directory.

| Module                   | Responsibility                                 |
| ------------------------ | ---------------------------------------------- |
| `profession/registry.ts` | Lazy registry of every profession              |
| `create-runtime.ts`      | Connects application builds to `simulateGw2()` |
| `create-adapter.ts`      | Composes native profession browser adapters    |

The registry is also where a completely new profession would be exposed to the application.

---

## `js/games/gw2/app/build/`

Build authoring and persistence.

Examples include:

```text
state/persistence.ts
state/skill-selection.ts
io/files.ts
panels/gear.tsx
panels/traits.tsx
panels/attributes.tsx
panels/skills.tsx
panels/assumptions.tsx
panels/presets.ts
page-controls.ts
```

This layer may translate a build into application state, but it should not implement profession combat mechanics.

---

## `js/games/gw2/app/rotation/`

The shared rotation-builder application.

Important modules include:

| Module            | Responsibility                                               |
| ----------------- | ------------------------------------------------------------ |
| `index.ts`        | Rotation-builder orchestration                               |
| `editing/`        | Rotation mutations, history, and entry editors               |
| `input/`          | Hotkeys and GW2 keybind import                               |
| `palette/`        | Palette state, resources, rendering, and interaction         |
| `timeline/`       | Timeline model, rendering, interaction, and display controls |
| `state-snapshot/` | Insertion-aware state queries and active-state rendering     |
| `result/`         | Results, loop analysis, event log, and warnings              |
| `shared/`         | Cross-feature context and icon helpers                       |

Profession-specific rotation presentation is supplied through profession UI hooks rather than hard-coded here.

---

## `js/games/gw2/app/simulation/`

Application-level simulation services.

Examples include:

```text
config.ts
random-distribution.ts
random-distribution-runner.ts
modifier-contributions.ts
modifier-contribution-runner.ts
relic-comparison-runner.ts
relic-comparison.ts
```

These modules orchestrate simulation work around the shared engine.

They should not own profession mechanics.

---

## `js/games/gw2/integrations/patches/app/`

Local balance-patch authoring UI.

This subsystem reads patch-authoring metadata exposed by native professions and lets developers author the active
preview without manually editing most of the patch manifest.

See [PATCH-PREVIEW.md](./PATCH-PREVIEW.md).

---

# Neutral kernel

```text
js/kernel/
```

The kernel contains the small primitives that make sense for any deterministic simulator: monotonic clock helpers,
collections, seeded randomness, stable event queues, caller-owned event-stream identity, and observation windows. It
must not import application or game packages.

---

# Neutral UI

```text
js/ui/
```

Neutral UI owns stable summary, breakdown, timeline, effect-lane, warning, state-snapshot, and extension-panel models.
GW2 adapts its existing output through `js/games/gw2/app/presentation.ts`.

## Browser UI ownership

The Vite templates own the static document and stable mount containers. React exclusively owns descendants of these
dynamic surfaces:

- build attributes, traits, skills, gear, and assumptions;
- simulation summaries, warnings, tables, event logs, state snapshots, loop analysis, and patch preview;
- the rotation palette, starting-resource controls, timeline, proc overlays, and timeline display controls.

`js/ui/react-root.ts` is the only mounting bridge. Existing `renderX(app)` entry points locate a stable container and
render the matching TSX component; imperative application code must not query or mutate that root's descendants.

Canvas charts remain imperative leaves mounted from React refs with effect cleanup. Floating rotation editors remain
separate imperative widgets outside the React roots. Profession presentation hooks return framework-neutral view data,
and platform, engine, worker, persistence, and headless profession modules must not import React.

See [REACT_MIGRATION.md](./REACT_MIGRATION.md) for the completed migration boundaries and testing rules.

---

# GW2 simulation engine

```text
js/games/gw2/platform/engine/
```

This engine is part of the GW2 package because its scheduler, effects, skills, cooldowns, state, and profession
contracts use GW2-shaped data. Only genuinely game-neutral primitives move to `js/kernel/`.

Examples include:

- scheduler infrastructure;
- cooldown/ammo machinery;
- state containers;
- effect materialization primitives;

Important modules include:

| Module                         | Responsibility                                     |
| ------------------------------ | -------------------------------------------------- |
| `execution/scheduler.ts`       | Declarative scheduler and profession-hook dispatch |
| `execution/state.ts`           | Profession-neutral scheduler state                 |
| `execution/tasks.ts`           | Ordered delayed state work                         |
| `events/scheduled-stream.ts`   | Scheduler-to-resolver event boundary               |
| `execution/cooldowns.ts`       | Cooldown and ammo state machine                    |
| `effects/factories.ts`         | Canonical effect constructors                      |
| `effects/materializer.ts`      | Converts effects into scheduled events             |
| `skills/autoattack-chains.ts`  | Autoattack-chain indexing                          |
| `profession/family.ts`         | Core + specialization contract composition         |
| `profession/module.ts`         | Profession module composition                      |
| `profession/ui-combinators.ts` | Composition helpers for profession UI slices       |
| `types.d.ts`                   | Shared engine contracts                            |

Stable event ordering is owned by the game-neutral `js/kernel/events/queue.ts` module.

If a new abstraction would still make sense in a non-GW2 simulator, consider `js/kernel/`; otherwise keep it here.

---

# Shared Guild Wars 2 platform

```text
js/games/gw2/platform/
```

This layer owns behavior shared by multiple Guild Wars 2 professions.

Examples include:

- strike damage formulas;
- condition damage;
- attributes;
- weapon strength;
- boons and target state;
- sigils;
- relics;
- profession module assembly;
- modifier rules;
- patch overlays.

Important modules include:

| Module                            | Responsibility                                  |
| --------------------------------- | ----------------------------------------------- |
| `simulation/simulate.ts`          | Canonical `simulateGw2()` entry point           |
| `combat/modifiers/rules.ts`       | Declarative scalar modifier system              |
| `builds/attributes.ts`            | Shared attribute calculations                   |
| `combat/damage/calculations.ts`   | Strike and condition damage formulas            |
| `equipment/weapons/strength.ts`   | Weapon-strength profiles                        |
| `equipment/sigils/rules.ts`       | Shared sigil behavior                           |
| `equipment/`                      | Gear, consumable, relic, sigil, and weapon data |
| `combat/state/targets.ts`         | Target assumptions                              |
| `combat/state/traits.ts`          | Shared selected-trait lookup                    |
| `combat/state/event-ownership.ts` | Player/summon/effect ownership rules            |

Native profession and balance-preview authoring lives under `js/games/gw2/integrations/patches/authoring/`.

Subdirectories such as:

```text
scheduler/
resolver/
```

contain the shared Guild Wars 2 scheduling and resolution pipeline.

---

# Simulation phases

Combat simulation has two major phases.

```text
rotation
   ↓
scheduler
   ↓
scheduled events
   ↓
resolver
   ↓
result
```

## Scheduler

The scheduler answers questions such as:

- can this skill be used now?
- how long does it cast?
- when does its cooldown begin?
- what resource does it spend?
- what events should it emit?
- what delayed state transitions should occur?

Profession-owned scheduler behavior usually lives in:

```text
skills/execution.ts
availability.ts
mechanics/<concept>.ts
traits/<trait-line>.ts
```

depending on the mechanic.

## Resolver

The resolver answers questions such as:

- how much damage does this strike deal?
- did it crit?
- what condition is applied?
- which modifier applies?
- how does the target state change?
- what happens in reaction to the resolved event?

Profession-specific resolution generally belongs in:

```text
mechanics/<concept>.ts
mechanics/<large-concept>/resolution.ts
traits/<trait-line>.ts
```

Shared GW2 resolution belongs in:

```text
js/games/gw2/platform/resolver/
```

---

# Profession modules

```text
js/games/gw2/content/professions/<profession>/
```

Each profession is implemented as a **Core module plus one module for each elite specialization**.

For example:

```text
js/games/gw2/content/professions/warrior/
├── core/
├── specializations/
│   ├── berserker/
│   ├── spellbreaker/
│   ├── bladesworn/
│   └── paragon/
├── modules.ts
└── definition.ts
```

The runtime composition is:

```text
Core module
      +
active specialization module
      ↓
defineNativeProfession()
      ↓
executable profession contract
```

Core is always present.

Exactly one specialization module is active for an elite-specialization build.

---

# The four module boundaries

Every native module is declared through:

```ts
defineNativeModule({
  id,
  data,
  state,
  mechanics,
  presentation
});
```

These four fields are the most important ownership boundaries in the profession system.

## `data`

Catalog contributions owned by the module.

Examples:

- skill mechanics;
- balance profiles;
- extra synthetic/action skills;
- trait metadata;
- weapon metadata;
- autoattack-chain metadata.

Example:

```ts
data: createWarriorModuleData("Berserker", {
  skillMechanics: BERSERKER_SKILL_MECHANICS,
  balanceProfiles: BERSERKER_BALANCE_PROFILES,
}),
```

---

## `state`

Runtime state owned by the module.

Example:

```ts
state: {
  scheduler: berserkerState.create,
  resolver: berserkerState.create,
},
```

Core modules may also expose public end-state projection:

```ts
state: {
  scheduler: createWarriorCoreState,
  resolver: createWarriorCoreState,
  project: projectWarriorEndState,
},
```

Do not place temporary runtime mechanics in application build state just because they need to be visible in the UI.

---

## `mechanics`

Executable combat behavior.

Common contributions include:

```ts
mechanics: {
  modifiers,
  execution: {
    skillHandlers,
    availability,
    castLifecycle,
    castRules,
    hooks,
  },
  resolution: {
    reactions,
    hooks,
  },
}
```

For example:

```ts
mechanics: {
  modifiers: berserkerAttributeRules,
  execution: {
    skillHandlers: berserkerSkillHandlers,
    castRules: berserkerCastRules,
    hooks: berserkerSchedulerHooks,
  },
  resolution: {
    reactions: berserkerReactions,
  },
},
```

The phase sections describe where behavior runs, not where its source file must live. A concept module such as
`mechanics/adrenaline.ts` may export both an execution contribution and a resolution contribution. `module.ts` exposes
those contributions once under the appropriate sections. Do not create execution and resolution copies of the same GW2
definition.

Native profession modules do not support flat phase fields or `data.handlers`. Register scheduler-owned behavior under
`mechanics.execution` and resolver-owned behavior under `mechanics.resolution`; runtime validation reports the exact
replacement path when JavaScript callers use a retired field.

Mechanics should normally be implemented in owner-local files and assembled by `module.ts`.

`module.ts` should remain an assembly file rather than becoming the place where large mechanics are implemented.

---

## `presentation`

Profession-owned UI behavior.

Usually:

```ts
presentation: berserkerUi;
```

or for UI that requires the completed catalog:

```ts
presentation: bindWarriorCoreUi;
```

Presentation can contribute things such as:

- profession palette groups;
- skill-bar groups;
- resource displays;
- active-state snapshot items;
- timeline presentation;
- skill availability messaging;
- profession-specific event-log rows.

Combat rules do not belong here.

---

# Profession folder structure

There is no mandatory one-file-per-role template.

A small specialization can keep each domain compact:

```text
specializations/berserker/
├── module.ts
├── profiles.ts
├── state.ts
├── skills/
│   ├── index.ts
│   └── execution.ts
├── traits/
│   └── index.ts
├── mechanics/
│   └── berserk.ts
└── presentation.ts
```

A larger Core module should group by GW2 concept:

```text
core/
├── module.ts
├── skills/
│   ├── index.ts
│   ├── execution.ts
│   ├── slot-skills.ts
│   └── weapons/
│       ├── axe.ts
│       └── greatsword.ts
├── traits/
│   ├── index.ts
│   └── modifiers.ts
├── mechanics/
│   ├── adrenaline-and-endurance.ts
│   └── availability.ts
├── profiles.ts
├── state.ts
└── presentation.ts
```

These filenames are **ownership conventions, not required placeholders**.

Small modules should stay small.

Large mechanics should be split into descriptive files when that makes ownership clearer. Do not split merely to make
every profession look symmetrical, and do not default to one file per skill or trait.

For example:

```text
mechanics/shroud.ts
mechanics/tomes.ts
mechanics/legend-swap.ts
mechanics/kits.ts
mechanics/pets.ts
mechanics/illusions/
mechanics/attunements.ts
mechanics/dragon-trigger.ts
```

are preferable to allowing an unrelated `rules.ts` or `mechanics.ts` file to grow indefinitely.

---

# Common profession file roles

## `module.ts`

Assembles the vertical slice.

It should answer:

> What data, state, mechanics, and presentation does this module contribute?

Example:

```ts
export const berserkerModule = defineNativeModule({
  id: 'Berserker',

  data: createWarriorModuleData('Berserker', {
    skillMechanics: BERSERKER_SKILL_MECHANICS,
    balanceProfiles: BERSERKER_BALANCE_PROFILES
  }),

  state: {
    scheduler: berserkerState.create,
    resolver: berserkerState.create
  },

  mechanics: {
    modifiers: berserkerAttributeRules,
    execution: {
      skillHandlers: berserkerSkillHandlers,
      castRules: berserkerCastRules,
      hooks: berserkerSchedulerHooks
    },
    resolution: {
      reactions: berserkerReactions
    }
  },

  presentation: berserkerUi
});
```

Keep implementation details outside this file.

---

## `skills/`

Authoritative simulator mechanics for skills owned by the module.

Examples:

- coefficients;
- effects;
- cast times;
- cooldowns;
- resource costs;
- ammo;
- skill metadata needed by simulation;
- effect timing.

If ArenaNet changes the damage coefficient of a skill, this is usually the first place to inspect.

Group related skills by weapon, slot family, transformation, or another recognizable GW2 concept. Keep a single
`skills/index.ts` when the module is already cohesive.

---

## `profiles.ts`

Reusable mechanic/balance data that does not naturally belong to a single skill.

Use profiles when several skills or runtime mechanics consume the same structured data.

Profiles are also directly supported by the patch-preview system.

---

## `state.ts`

Defines module-owned runtime state.

Typical responsibilities include:

- initial scheduler state;
- resolver state;
- specialization state accessor;
- public end-state projection;
- state snapshots.

State fields should belong to the module that owns the mechanic.

---

## `mechanics/`

Profession and specialization systems that are not naturally owned by one skill or trait. Use GW2 concept names such as
`shatters.ts`, `continuum-split.ts`, `pets.ts`, `beastmode.ts`, `life-force.ts`, `attunements.ts`, `energy.ts`, or
`initiative-and-endurance.ts`.

A mechanics module may contain scheduler declarations, resolver declarations, or both. Its exports must make that phase
visible when assembled in `module.ts`. Shared strike and condition resolution stays under
`js/games/gw2/platform/resolver/`.

Generic `rules.ts`, `handlers.ts`, and `resolver.ts` ownership files are retired. Keep a cohesive availability file when
it expresses one module's cast gate; split unrelated behavior into a named mechanic, skill family, or trait line.

---

## `traits/`

Imperative trait mechanics.

Use this when a trait does more than contribute a declarative scalar modifier.

Examples include:

- proc cooldowns;
- emitted events;
- state transitions;
- trait-triggered buffs;
- reactions to casts or hits.

Simple scalar trait modifiers should generally use the declarative modifier system instead.

---

## `resources.ts`

Optional focused home for profession-resource behavior.

Examples:

- adrenaline;
- initiative;
- energy;
- life force;
- flow;
- pages;
- ammunition-like profession resources.

The associated state still belongs to the module's runtime state.

---

## `events.ts`

Optional home for profession-specific scheduled event definitions and event helpers.

Use this when the module emits custom typed events that are shared by multiple mechanics.

---

## `actions.ts`

Optional home for profession-owned synthetic actions or action helpers.

Use descriptive action ownership rather than placing these in unrelated skill files.

---

## `shared.ts`

Helpers shared only within one profession or module family.

Do not move owner-specific helpers into `js/games/gw2/platform/` simply to avoid imports between profession files.

A helper should become platform code only when it represents genuinely reusable engine or Guild Wars 2 behavior.

---

## `presentation.ts`

Profession presentation hooks.

Examples:

- palette groups;
- profession resources;
- skill-bar mechanics;
- active-state snapshot entries;
- timeline presentation;
- skill icons;
- UI availability messages;
- event-log presentation.

`presentation.ts` should read simulation state, not independently reproduce combat mechanics.

---

# Core versus specialization ownership

Put a mechanic in **Core** when it applies to the profession regardless of active elite specialization.

Examples:

```text
Warrior adrenaline
Elementalist attunements
Thief initiative
Revenant energy
```

Put a mechanic in an elite specialization module when that specialization owns it.

Examples:

```text
Berserker Berserk
Bladesworn Dragon Trigger
Reaper Shroud behavior
Mechanist Jade Mech
Firebrand tomes
```

A specialization may reuse Core helpers, but Core should not depend on specialization modules.

---

# `modules.ts`

Each profession exposes one Core-first module tuple.

Example:

```ts
export const warriorNativeModules = Object.freeze([
  warriorCoreModule,
  berserkerModule,
  spellbreakerModule,
  bladeswornModule,
  paragonModule
] as const);
```

Core must be first.

This file should contain composition only.

---

# `definition.ts`

`definition.ts` creates and exports the native profession contract.

Example:

```ts
export const warriorProfession = defineNativeProfession({
  id: 'warrior',
  name: 'Warrior',

  build: {
    createBuildDefaults: createWarriorBuildDefaults,
    migrateBuild: migrateWarriorBuild,
    validateBuild: validateWarriorBuild
  },

  modules: warriorNativeModules,
  patchPreview: activePatchPreview
});
```

This is where:

- the profession ID/name;
- build contract;
- native modules;
- active patch preview;

come together.

---

Engine/headless callers can import the profession through this stable boundary without loading the browser application
adapter.

---

# Profession application definition

Browser-specific profession assembly belongs separately under:

```text
js/games/gw2/content/professions/<profession>/app/
```

This layer owns things such as:

- attribute calculation wiring;
- simulation config extras;
- persistence configuration;
- adapter construction;
- browser-facing profession behavior.

Keep it separate from the engine-facing `definition.ts`.

This separation allows:

```ts
import { warriorProfession } from './js/games/gw2/content/professions/warrior/definition.js';
```

to work for headless simulation without loading browser UI/storage code.

See [PROGRAMMATIC-SIMULATION.md](./PROGRAMMATIC-SIMULATION.md).

---

# Catalog ownership

Profession modules contribute catalog fragments.

The final profession catalog is assembled from:

```text
Core data
+
specialization data
+
shared generated identity
```

Modules should not import their profession's completed root catalog.

That creates a circular ownership relationship:

```text
module
  ↓
root catalog
  ↓
module
```

Instead, owner-local modules contribute data upward and receive the completed catalog only through supported
composition/presentation boundaries where required.

---

# Build persistence

Profession build defaults, migrations, and validation belong in:

```text
js/games/gw2/content/professions/<profession>/build/build.ts
```

Shared Guild Wars 2 build contracts belong in:

```text
js/games/gw2/platform/builds/
├── assumptions.ts
├── codec.ts
└── slot-loadout.ts
```

Shared simulation randomness assumptions belong in `js/games/gw2/platform/simulation/randomness.ts`.

Profession code should own only the fields that are unique to that profession.

Examples:

- starting attunement;
- initial initiative;
- selected legends;
- starting life force;
- profession-specific skill selections.

Do not duplicate common gear/sigil/relic/weapon normalization inside individual professions.

---

# Log analyzers

```text
js/games/gw2/integrations/logs/
├── lib/
├── evtc/
└── dps-report/
```

The shared library owns normalized action/result contracts, catalog and profile lookup, player selection, replay
scheduling, and reusable rules. Neither adapter may import implementation code from the other.

The EVTC adapter owns raw ArcDPS behavior:

This includes:

- decompression;
- binary parsing;
- player detection;
- EVTC statistics;
- rotation reconstruction;
- profession-specific EVTC inference.

The simulator engine should not contain EVTC-specific assumptions.

Reconstructed EVTC actions are translated into normal simulator rotations before execution.

See [EVTC-ROTATION-RECONSTRUCTION.md](../EVTC-ROTATION-RECONSTRUCTION.md).

---

# dps.report adapter

```text
js/games/gw2/integrations/logs/dps-report/
```

Owns behavior related to Elite Insights / dps.report data.

It is separate from raw EVTC parsing because Elite Insights exposes a different, already-processed representation with
different information loss and inference requirements.

Do not add dps.report-specific parsing logic to profession simulator modules.

---

# Patch previews

Patch preview data lives under:

```text
js/games/gw2/integrations/patches/
```

The local authoring application lives under:

```text
js/games/gw2/integrations/patches/app/
```

Patch previews are sparse overlays on top of existing profession-owned data.

A preview should patch a value where that value already belongs:

```text
skill change           → skills.ts-backed catalog data
profile change         → profiles.ts
modifier change        → declarative modifier rule
imperative constant    → explicit patchRuntimeValue seam
behavior change        → ordinary patch-aware implementation
```

See [PATCH-PREVIEW.md](./PATCH-PREVIEW.md).

---

# UI ownership

```text
js/ui/
```

This layer contains reusable UI models and primitives that are independent of any game. GW2-specific result transforms,
tables, charts, event rendering, icons, and rotation presentation live under:

```text
js/games/gw2/app/presentation/
```

The dependency direction should remain:

```text
game presentation
 ↓
ui
```

not:

```text
ui
 ↓
game or app
```

Profession presentation reaches the application through explicit UI hooks rather than by importing application modules
into platform code.

---

# Adding a new profession mechanic

For a new mechanic, start by answering four questions.

## 1. Who owns it?

```text
all professions
→ platform

one profession
→ Core

one specialization
→ that specialization
```

## 2. Is it data or behavior?

```text
skill/effect numbers
→ skills.ts

shared mechanic values
→ profiles.ts

runtime state
→ state.ts

execution behavior
→ owning skill, trait, or descriptive mechanic file

presentation
→ presentation.ts
```

## 3. Which phase owns it?

```text
before/during cast or delayed state
→ scheduler side

damage/condition/result reaction
→ resolver side
```

## 4. Does it already have a source of truth?

Prefer extending existing state/events/profiles rather than creating parallel copies.

For example, if a timed buff already exists in the simulation event timeline, UI should read that timeline rather than
maintaining a duplicate UI timer.

---

# Adding a new elite specialization

A new specialization normally requires:

```text
js/games/gw2/content/professions/<profession>/specializations/<specialization>/
```

with only the files needed by that specialization.

At minimum, the module needs to provide:

```ts
defineNativeModule({
  id: 'New Specialization',
  data,
  state,
  mechanics,
  presentation
});
```

Then add the module to:

```text
js/games/gw2/content/professions/<profession>/modules.ts
```

after Core.

The exact files inside the specialization directory should follow the mechanic's complexity rather than a fixed
template.

Also update:

- profession catalog/generated data where required;
- build specialization metadata;
- trait coverage;
- relevant tests;
- profession documentation.

---

# Adding a completely new profession

A completely new profession requires both engine and application integration.

At a high level:

```text
js/games/gw2/content/professions/new-profession/
    core/
    specializations/
    modules.ts
    definition.ts
    catalog.ts
    catalog/
        module-data.ts
    build/
        build.ts
        attributes.ts
    data/
        ... generated/static inputs
    state.ts
    app/
```

Use `state/` only when the family projection has multiple substantive files.

Then register it in:

```text
js/games/gw2/app/profession/registry.ts
```

and provide the associated profession page/build data.

Use an existing native profession as the reference rather than creating a new composition pattern.

---

# Tests

Tests should generally live near the subsystem they validate.

Examples:

```text
tests/platform/
tests/professions/
tests/app/
tests/evtc/
tests/dps-report/
tests/browser/
tests/scripts/
tests/typecheck/
```

Prefer focused mechanic tests over large snapshots.

For profession mechanics, test the smallest meaningful contract:

```text
availability
state transition
resource change
modifier result
event emission
resolver reaction
UI projection
```

Full preset regression tests provide broader confidence that saved builds still simulate successfully.

Architecture/typecheck tests enforce cross-module ownership and composition contracts.

---

# Ownership principles

When deciding where new code belongs, follow these principles:

1. **Keep profession behavior with its profession.**
2. **Keep specialization-only behavior with its specialization.**
3. **Move code to `js/games/gw2/platform/` only when it represents reusable Guild Wars 2 behavior.**
4. **Move code to `js/games/gw2/platform/engine/` only when it is shared by profession runtimes.**
5. **Keep browser concerns in `app`.**
6. **Keep `module.ts`, `modules.ts`, and `definition.ts` focused on composition.**
7. **Prefer descriptive files over oversized generic files.**
8. **Do not create empty files merely to satisfy a folder convention.**
9. **Do not duplicate an existing source of truth.**
10. **Keep headless engine imports independent of browser application code.**

The practical distinction is:

> [ARCHITECTURE.md](./ARCHITECTURE.md) explains **how the simulator works**.  
> `MODULES.md` explains **where a change belongs**.
