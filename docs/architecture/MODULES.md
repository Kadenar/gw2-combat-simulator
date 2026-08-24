# Simulator modules

This document is a **code ownership guide** for the Guild Wars 2 combat simulator.

Use it when you know what you want to change but are unsure **which module or directory should own that change**.

For the reasoning behind the architecture, simulation phases, dependency rules, and profession contracts, see
[ARCHITECTURE.md](./ARCHITECTURE.md).

## Repository map

| Path                      | Purpose                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| `js/app/`                 | Profession-neutral browser application and UI orchestration                                     |
| `js/platform/engine/`     | Generic scheduler, event queue, state, and simulation primitives                                |
| `js/platform/gw2/`        | Shared Guild Wars 2 formulas, resolver logic, data, gear, relics, and profession infrastructure |
| `js/platform/ui/`         | Shared UI/view-model primitives                                                                 |
| `js/professions/`         | Profession-owned builds, skills, state, mechanics, traits, resolver behavior, and UI            |
| `js/evtc-analyzer/`       | ArcDPS EVTC parsing, analysis, and rotation reconstruction                                      |
| `js/dps-report-analyzer/` | Elite Insights / dps.report analysis and rotation reconstruction                                |
| `js/app/patch-preview/`   | Local patch-preview authoring UI                                                                |
| `js/patches/`             | Active balance-preview manifest                                                                 |
| `Builds/`                 | Saved simulator build presets                                                                   |
| `Rotations/`              | Saved simulator rotation presets                                                                |
| `tests/`                  | Unit, integration, architecture, browser, and regression tests                                  |
| `scripts/`                | Build, data generation, analysis, audit, and authoring tools                                    |

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
| Skill coefficient, hit count, condition, boon, timing, cooldown, etc. | Profession `skills.ts`                                |
| Shared mechanic data used by several skills                           | Profession `profiles.ts`                              |
| Profession runtime resource or state                                  | Profession `state.ts`                                 |
| Skill availability rule                                               | `availability.ts` or `rules.ts`                       |
| Resource gain/spend/regeneration                                      | `resources.ts`, `rules.ts`, or mechanic-specific file |
| Cast lifecycle behavior                                               | `rules.ts`, `handlers.ts`, or mechanic-specific file  |
| Declarative trait modifier                                            | `rules.ts`                                            |
| Complex trait proc or imperative behavior                             | `traits.ts`                                           |
| Scheduler-specific skill implementation                               | `handlers.ts`                                         |
| Custom scheduled event definitions                                    | `events.ts` or mechanic-specific file                 |
| Resolver reaction or custom resolved event                            | `resolver.ts`                                         |
| Profession UI, palette, skill-bar, or active-state display            | `ui.ts`                                               |
| Shared code used by several files within one profession               | `shared.ts`                                           |
| New reusable GW2 mechanic                                             | `js/platform/gw2/`                                    |
| Generic scheduling primitive unrelated to GW2                         | `js/platform/engine/`                                 |
| Browser-only behavior                                                 | `js/app/`                                             |
| Shared presentation/view-model behavior                               | `js/platform/ui/`                                     |
| EVTC parsing or reconstruction                                        | `js/evtc-analyzer/`                                   |
| dps.report / Elite Insights reconstruction                            | `js/dps-report-analyzer/`                             |
| Upcoming balance changes                                              | Patch-preview system                                  |
| Build migration/default/validation                                    | Profession `build.ts`                                 |
| New profession page/registry entry                                    | `js/app/profession/registry.ts`                       |

The main rule is:

> Put behavior with the layer that owns the underlying game concept.

Do not move profession-specific mechanics into shared platform code simply because multiple files need them. Likewise,
do not duplicate shared GW2 behavior inside individual professions.

---

# Application layer

```text
js/app/
```

`js/app/` owns the browser application.

It should contain **application behavior**, not Guild Wars 2 combat mechanics.

Examples include:

- loading and saving builds;
- rendering build panels;
- the rotation builder;
- charts and result displays;
- worker orchestration;
- import dialogs;
- patch-preview controls;
- browser navigation.

## Main application files

| Module              | Responsibility                                            |
| ------------------- | --------------------------------------------------------- |
| `app.ts`            | Browser entry point                                       |
| `bootstrap.ts`      | Resolves the active profession and starts the application |
| `profession-app.ts` | Shared application lifecycle and state coordinator        |
| `embed.ts`          | Embedded simulator entry/support                          |
| `tutorial.ts`       | Interactive application tutorial                          |

`ProfessionApp` coordinates the browser application but delegates profession-specific behavior to the active profession
adapter.

---

## `js/app/profession/`

Shared profession application composition.

| Module              | Responsibility                                     |
| ------------------- | -------------------------------------------------- |
| `registry.ts`       | Lazy registry of every profession                  |
| `create-adapter.ts` | Creates the browser adapter around a profession    |
| `create-runtime.ts` | Connects application builds to `simulateGw2()`     |
| `define-app.ts`     | Composes native profession application definitions |
| `assumptions.ts`    | Shared assumption-control contracts                |
| `slot-loadout.ts`   | Shared heal/utility/elite loadout behavior         |

The registry is also where a completely new profession would be exposed to the application.

---

## `js/app/build/`

Build authoring and persistence.

Examples include:

```text
persistence.ts
files.ts
gear-panel.ts
traits-panel.ts
attributes-panel.ts
skills-panel.ts
assumptions-panel.ts
presets.ts
selection.ts
page-controls.ts
```

This layer may translate a build into application state, but it should not implement profession combat mechanics.

---

## `js/app/rotation/`

The shared rotation-builder application.

Important modules include:

| Module            | Responsibility                                                  |
| ----------------- | --------------------------------------------------------------- |
| `index.ts`        | Rotation-builder orchestration                                  |
| `editing/`        | Rotation mutations, clipboard state, history, and entry editors |
| `input/`          | Hotkeys and GW2 keybind import                                  |
| `palette/`        | Palette state, resources, rendering, and interaction            |
| `timeline/`       | Timeline model, rendering, interaction, and display controls    |
| `state-snapshot/` | Insertion-aware state queries and active-state rendering        |
| `result/`         | Results, loop analysis, event log, and warnings                 |
| `shared/`         | Cross-feature context and icon helpers                          |

Profession-specific rotation presentation is supplied through profession UI hooks rather than hard-coded here.

---

## `js/app/simulation/`

Application-level simulation services.

Examples include:

```text
config.ts
randomness.ts
random-distribution.ts
random-distribution-runner.ts
modifier-contributions.ts
modifier-contribution-runner.ts
relic-comparison-runner.ts
patch-preview-view.ts
```

These modules orchestrate simulation work around the shared engine.

They should not own profession mechanics.

---

## `js/app/patch-preview/`

Local balance-patch authoring UI.

This subsystem reads patch-authoring metadata exposed by native professions and lets developers author the active
preview without manually editing most of the patch manifest.

See [PATCH-PREVIEW.md](./PATCH-PREVIEW.md).

---

# Shared engine

```text
js/platform/engine/
```

The engine layer contains simulator primitives that are **not specifically Guild Wars 2 rules**.

Examples include:

- scheduler infrastructure;
- deterministic task queues;
- event ordering;
- cooldown/ammo machinery;
- state containers;
- effect materialization primitives;
- generic skill factories.

Important modules include:

| Module                      | Responsibility                                     |
| --------------------------- | -------------------------------------------------- |
| `scheduler.ts`              | Declarative scheduler and profession-hook dispatch |
| `scheduler-state.ts`        | Profession-neutral scheduler state                 |
| `task-queue.ts`             | Ordered delayed state work                         |
| `event-queue.ts`            | Stable event ordering                              |
| `scheduled-event-stream.ts` | Scheduler-to-resolver event boundary               |
| `cooldown-controller.ts`    | Cooldown and ammo state machine                    |
| `effect-factories.ts`       | Canonical effect constructors                      |
| `effect-materializer.ts`    | Converts effects into scheduled events             |
| `skill-factories.ts`        | Shared skill constructors                          |
| `autoattack-chains.ts`      | Autoattack-chain indexing                          |
| `profession.ts`             | Core + specialization contract composition         |
| `ui-combinators.ts`         | Composition helpers for profession UI slices       |
| `types.d.ts`                | Shared engine contracts                            |

If a new abstraction would still make sense in a non-GW2 simulator, it probably belongs here.

---

# Shared Guild Wars 2 platform

```text
js/platform/gw2/
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

| Module                 | Responsibility                                |
| ---------------------- | --------------------------------------------- |
| `simulate.ts`          | Canonical `simulateGw2()` entry point         |
| `native-profession.ts` | Native profession/module authoring layer      |
| `modifier-rules.ts`    | Declarative scalar modifier system            |
| `attributes.ts`        | Shared attribute calculations                 |
| `damage.ts`            | Strike and condition damage formulas          |
| `weapon-strength.ts`   | Weapon-strength profiles                      |
| `weapon-sigils.ts`     | Shared sigil behavior                         |
| `gear-data.ts`         | Shared equipment/consumable/relic lookup data |
| `target-state.ts`      | Target assumptions                            |
| `trait-state.ts`       | Shared selected-trait lookup                  |
| `event-ownership.ts`   | Player/summon/effect ownership rules          |
| `skill-patch.ts`       | Balance-preview overlay grammar               |

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
skills.ts
availability.ts
handlers.ts
resources.ts
rules.ts
traits.ts
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
resolver.ts
traits.ts
rules.ts
```

Shared GW2 resolution belongs in:

```text
js/platform/gw2/resolver/
```

---

# Profession modules

```text
js/professions/<profession>/
```

Each profession is implemented as a **Core module plus one module for each elite specialization**.

For example:

```text
js/professions/warrior/
├── core/
├── specializations/
│   ├── berserker/
│   ├── spellbreaker/
│   ├── bladesworn/
│   └── paragon/
├── modules.ts
├── family.ts
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
- skill handlers;
- trait metadata;
- weapon metadata;
- autoattack-chain metadata.

Example:

```ts
data: createWarriorModuleData("Berserker", {
  skillMechanics: BERSERKER_SKILL_MECHANICS,
  balanceProfiles: BERSERKER_BALANCE_PROFILES,
  handlers: berserkerSkillHandlers,
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
  castRules,
  schedulerHooks,
  resolverHooks,
  reactions,
}
```

For example:

```ts
mechanics: {
  modifiers: berserkerAttributeRules,
  castRules: berserkerCastRules,
  schedulerHooks: berserkerSchedulerHooks,
  reactions: berserkerReactions,
},
```

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

A typical specialization might look like:

```text
specializations/berserker/
├── module.ts
├── skills.ts
├── profiles.ts
├── state.ts
├── rules.ts
├── handlers.ts
├── resolver.ts
└── ui.ts
```

A larger Core module may instead look like:

```text
core/
├── module.ts
├── skills.ts
├── profiles.ts
├── state.ts
├── rules.ts
├── handlers.ts
├── resolver.ts
├── traits.ts
├── resources.ts
├── availability.ts
├── actions.ts
├── events.ts
├── shared.ts
└── ui.ts
```

These filenames are **ownership conventions, not required placeholders**.

Small modules should stay small.

Large mechanics should be split into descriptive files when that makes ownership clearer.

For example:

```text
shroud.ts
tomes.ts
legends.ts
kits.ts
pets.ts
illusions.ts
attunements.ts
dragon-trigger.ts
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
    balanceProfiles: BERSERKER_BALANCE_PROFILES,
    handlers: berserkerSkillHandlers
  }),

  state: {
    scheduler: berserkerState.create,
    resolver: berserkerState.create
  },

  mechanics: {
    modifiers: berserkerAttributeRules,
    castRules: berserkerCastRules,
    schedulerHooks: berserkerSchedulerHooks,
    reactions: berserkerReactions
  },

  presentation: berserkerUi
});
```

Keep implementation details outside this file.

---

## `skills.ts`

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

## `rules.ts`

Composes mechanic rules.

Common responsibilities include:

- declarative modifiers;
- cast rules;
- scheduler hooks;
- shared predicates;
- state transitions;
- trait-independent mechanic rules.

`rules.ts` does not need to own every rule in a large module. Split focused concerns into files such as
`availability.ts` or `resources.ts` when useful.

---

## `availability.ts`

Optional focused home for cast availability.

Use it when availability logic is large enough that keeping it inside `rules.ts` would obscure other mechanics.

Examples:

- resource requirements;
- transformation requirements;
- active stance/form requirements;
- profession state gates.

---

## `handlers.ts`

Skill-specific scheduler behavior.

Handlers should primarily coordinate behavior associated with explicit skills.

Do not turn `handlers.ts` into the general home for unrelated profession mechanics.

---

## `resolver.ts`

Profession behavior that runs during the resolver phase.

Examples:

- reactions to resolved damage;
- custom profession events;
- on-condition behavior;
- resolver-owned proc logic.

Shared strike and condition resolution stays under `js/platform/gw2/resolver/`.

---

## `traits.ts`

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

Do not move owner-specific helpers into `js/platform/` simply to avoid imports between profession files.

A helper should become platform code only when it represents genuinely reusable engine or Guild Wars 2 behavior.

---

## `ui.ts`

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

`ui.ts` should read simulation state, not independently reproduce combat mechanics.

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

# `family.ts`

`family.ts` creates the actual native profession contract.

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

# `definition.ts`

`definition.ts` is the stable public profession export.

For example:

```ts
export { warriorProfession, warriorProfession as default } from './family.js';
```

Engine/headless callers can import the profession through this stable boundary without loading the browser application
adapter.

---

# Profession application definition

Browser-specific profession assembly belongs separately under:

```text
js/professions/<profession>/app/
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
import { warriorProfession } from './js/professions/warrior/definition.js';
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
js/professions/<profession>/build.ts
```

Shared Guild Wars 2 build normalization belongs in:

```text
js/platform/gw2/build-codec.ts
```

Profession code should own only the fields that are unique to that profession.

Examples:

- starting attunement;
- initial initiative;
- selected legends;
- starting life force;
- profession-specific skill selections.

Do not duplicate common gear/sigil/relic/weapon normalization inside individual professions.

---

# EVTC analyzer

```text
js/evtc-analyzer/
```

Owns raw ArcDPS EVTC behavior.

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

# dps.report analyzer

```text
js/dps-report-analyzer/
```

Owns behavior related to Elite Insights / dps.report data.

It is separate from raw EVTC parsing because Elite Insights exposes a different, already-processed representation with
different information loss and inference requirements.

Do not add dps.report-specific parsing logic to profession simulator modules.

---

# Patch previews

Patch preview data lives under:

```text
js/patches/
```

The local authoring application lives under:

```text
js/app/patch-preview/
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

# Shared UI platform

```text
js/platform/ui/
```

This layer contains reusable UI models and primitives that are independent of any particular profession.

The dependency direction should remain:

```text
app
 ↓
platform/ui
```

not:

```text
platform/ui
 ↓
app
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
→ rules / handlers / resolver / descriptive mechanic file

presentation
→ ui.ts
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
js/professions/<profession>/specializations/<specialization>/
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
js/professions/<profession>/modules.ts
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
js/professions/new-profession/
    core/
    specializations/
    modules.ts
    family.ts
    definition.ts
    build.ts
    app/
```

Then register it in:

```text
js/app/profession/registry.ts
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
3. **Move code to `platform/gw2` only when it represents reusable Guild Wars 2 behavior.**
4. **Move code to `platform/engine` only when it is game-neutral simulation infrastructure.**
5. **Keep browser concerns in `app`.**
6. **Keep `module.ts`, `modules.ts`, and `family.ts` focused on composition.**
7. **Prefer descriptive files over oversized generic files.**
8. **Do not create empty files merely to satisfy a folder convention.**
9. **Do not duplicate an existing source of truth.**
10. **Keep headless engine imports independent of browser application code.**

The practical distinction is:

> [ARCHITECTURE.md](./ARCHITECTURE.md) explains **how the simulator works**.  
> `MODULES.md` explains **where a change belongs**.
