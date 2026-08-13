# Simulator Modules Documentation

Overview of the TypeScript modules in the combat simulator, organized by
functionality. The shared shell is profession-neutral; each profession supplies
its own catalog and mechanics. Native professions also supply an application
definition for the shared browser shell.

---

## Application Layer (`js/app/`)

Profession-neutral browser shell: UI rendering, state management, and user
interaction orchestration. A profession application adapter injects its catalog,
codec, storage key, renderer hooks, and worker.

### Entry and controller

- [app.ts](js/app/app.ts) is the browser entry point and only registers the
  `DOMContentLoaded` bootstrap.
- [bootstrap.ts](js/app/bootstrap.ts) resolves the page's profession adapter
  and initializes the application.
- [profession-app.ts](js/app/profession-app.ts) exports the thin
  `ProfessionApp` lifecycle coordinator. Rendering and background analysis are
  delegated to their owning feature modules.

### Profession `definition.ts` and `app/app-definition.ts`

Each native profession has two deliberately separate composition boundaries:

- `definition.ts` exports the stable profession source. For a family this is
  an application contract plus `resolveRuntime(config)`; executable resources,
  rules, hooks, and registries exist only on the resolved runtime.
- `app/app-definition.ts` composes that contract for the shared browser shell.
  It constructs the build attribute calculator and application runtime, then
  supplies persistence metadata, import/export filenames, selector behavior,
  build-to-simulation mapping, and the application adapter.

Keeping browser composition out of `definition.ts` lets simulations and other
engine consumers load a profession without pulling in application rendering,
storage, and modifier-contribution dependencies. Elementalist remains a
standalone application with its profession-owned scheduler and resolver.

Engineer, Guardian, Mesmer, Necromancer, Ranger, Revenant, Thief, and Warrior
share the family boundary. `core/` owns always-active behavior;
`specializations/<elite>/` owns each elite vertical slice. A slice normally
contains `module`, `state`, `skills`, `resolver`, `mechanics`, `rules`, and
`ui`. It contains `handlers` only when it contributes local skill handlers and
`traits` when it has imperative trait behavior. Empty handler placeholders are
not used. Profession-unique mechanics retain descriptive filenames. `modules`
owns the single Core-first module tuple;
`family` passes it to `defineNativeProfession()`. The full application catalog
and active runtime fragments are derived from those modules.
`platform/gw2/native-profession.ts` owns the typed authoring API and catalog
derivation, while
`platform/engine/profession.ts` remains responsible for hook composition,
cached runtime resolution, and generic application UI dispatch.

### Profession composition (`js/app/profession/`)

[registry.ts](js/app/profession/registry.ts) is the single lazy manifest for
every profession exposed by the application. Each
entry supplies a stable ID, display metadata, route, optional theme class,
explicit application kind, and dynamic loaders for the profession contract
and shared-shell app adapter. Registry entries are validated for stable unique
IDs and routes when the module loads, then shallow-frozen.

The main exports are:

- `professionRegistry`: all routes, including standalone legacy applications.
- `nativeProfessionRegistry`: entries declared with
  `applicationKind: "native"`; these must have a shared-shell app adapter.
- `standaloneProfessionRegistry`: legacy applications declared with
  `applicationKind: "standalone"` and no shared-shell adapter.
- `professionOptions` and `PROFESSION_ROUTES`: frozen projections for UI and
  compatibility consumers.
- `getProfessionEntry()` and `professionRoute()`: synchronous metadata and
  route lookup. Unknown IDs resolve to `null` and `index.html`, respectively.
- `loadProfession()` and `loadProfessionAppAdapter()`: lazy loaders. The
  adapter loader returns `null` for unknown or standalone applications.

Loader paths are explicit so they remain statically discoverable. Importing
the registry itself does not load profession implementations. To expose a new
profession, add one entry with its page metadata and loader functions;
native applications use `applicationKind: "native"` and standalone
applications use `applicationKind: "standalone"`. Elementalist can move from
standalone to native later by changing that field and supplying its adapter.

[selector.ts](js/app/profession/selector.ts) provides registry-driven
landing-page and header navigation. `bindProfessionSelector()`
renders cards into an optional `[data-profession-grid]`, rebuilds the optional
`#profession-select`, applies the active entry's theme class, and navigates when
the selection changes. The active ID is read first from
`body[data-profession]`, then from the selector's
`data-active-profession`; unknown or absent IDs produce a disabled placeholder.

The module automatically binds in a browser and is inert when `document` is
unavailable. Missing grid and selector elements are valid, allowing the same
script on landing and simulator pages. `PROFESSION_ROUTES` and
`professionRoute()` are re-exported for compatibility; their source of truth is
the registry.

The remaining profession modules define the shared application composition
surface:

- `create-adapter.ts` and `create-runtime.ts` build a profession's browser
  adapter and simulation runtime.
- `define-app.ts` composes native profession application definitions.
- `assumptions.ts` and `slot-loadout.ts` own shared profession-facing UI
  contracts.

### Build UI (`js/app/build/`)

Build configuration is grouped by feature:

- `persistence.ts` creates, loads, saves, and replaces application builds.
- `files.ts` handles build and rotation JSON import/export.
- `options.ts` owns shared option metadata and HTML option generation.
- `selection.ts` normalizes selectable slot skills.
- `gear-panel.ts`, `traits-panel.ts`, `attributes-panel.ts`,
  `skills-panel.ts`, and `assumptions-panel.ts` render and bind their own DOM
  panels.
- `presets.ts` owns profession build templates, paired build/rotation loading,
  partial-load actions, and undo; `page-controls.ts` owns persistent page
  controls.

### Rotation UI (`js/app/rotation/`)

Rotation-builder behavior is split into explicit models and views:

- `index.ts` orchestrates the complete rotation builder.
- `actions.ts` mutates rotation entries.
- `palette-model.ts` and `palette-view.ts` own palette state and rendering.
- `resource-view.ts` renders starting-resource controls.
- `timeline-model.ts` builds rows, markers, and proc groups;
  `timeline-view.ts` renders and binds the timeline.
- `event-log.ts` and `warnings.ts` transform and mount diagnostics.
- `result-model.ts` creates metrics, chart series, and breakdown rows;
  `result-view.ts` mounts results.
- `icons.ts` resolves palette, proc, and result icons.

These modules compose the generic widgets in `js/platform/ui/`; platform UI
does not depend on the application layer.

### Simulation application services (`js/app/simulation/`)

- `config.ts` builds the shared GW2 simulation configuration.
- `randomness.ts` owns the persisted deterministic/distribution mode shared by
  every native profession.
- `random-distribution.ts` and `modifier-contributions.ts` contain pure
  partitioning and analysis functions.
- Their `*-runner.ts` modules own timers, request IDs, and worker pools instead
  of storing background-job state on `ProfessionApp`.
- Their `*-worker.ts` modules are the browser worker entry points.

Per-profession build-to-simulation mapping and modifier candidates remain under
each profession's `app/` directory.

---

## Data ownership

Static Guild Wars 2 game data and lookups live with their owning layer.

- Generated profession API metadata lives in each profession's
  `data/<profession>-api-metadata.js`; authoritative formulas live in
  owner-local Core or elite `skills.ts`. A root
  `mechanics/skill-mechanics.ts` is an inert compatibility aggregate only.
- [Shared gear data](js/platform/gw2/gear-data.ts) contains equipment,
  consumable, infusion, weapon, sigil, rune, and relic lookups.
- [weapon-strength.ts](js/platform/gw2/weapon-strength.ts) owns canonical
  min/max weapon, non-weapon, bundle, transform, and shroud strength profiles.
- Elementalist-owned data and CSV loading live under
  `js/professions/elementalist/data/`.

---

## Shared GW2 Mechanics (`js/platform/gw2/`)

Attribute calculations and damage formulas.

### [native-profession.ts](js/platform/gw2/native-profession.ts)

Strongly typed native-profession authoring layer. `defineNativeModule()` groups
one vertical slice as `data`, `state`, `mechanics`, and `presentation` while
retaining its literal ID and inferred scheduler/resolver state.
`defineNativeProfession()` requires a Core-first module tuple and derives the
specialization union before compiling to the existing engine family contract.

`createNativeModuleData()` selects generated identity metadata for one module
and combines it with locally owned mechanics, handlers, traits, weapons, and
chains. `assembleNativeApplicationCatalog()` derives the complete build/editor
catalog. The same assembly derives Core-plus-active-specialization runtime
catalogs and validates collisions and handler ownership. Root `catalog.ts`
files remain stable exports; modules never import them, which avoids a
catalog-to-module cycle.

Recurring mechanics use phase-explicit helpers. Scheduler helpers are
`skillAvailability()` and `afterSkillEffects()`. Resolver helpers are
`onResolvedDamage()`, `onResolvedControl()`, `onResolvedBlind()`, and the
deterministic/stochastic `onResolvedPlayerCriticalHit()`. `augmentSkill()` and
`replaceSkill()` cover the usual handler declarations; modifier-rule arrays
are already strongly typed and need no wrapper.

Complex typed tasks, custom resolver events, unusual cast policies, and
existing multi-hook state machines may use the low-level
`mechanics.schedulerHooks`, `mechanics.resolverHooks`, `mechanics.castRules`,
or imperative modifier bundle escape hatches. Those hooks remain scheduler- or
resolver-specific; the two phases never share live mutable state.

### [build-codec.ts](js/platform/gw2/build-codec.ts)

Factory for the common native-profession build persistence contract.
`createGw2BuildCodec()` receives a profession ID, current schema version,
catalog, defaults factory, and optional migration/normalization/validation
hooks. It returns a frozen object with three operations:

- `migrateBuild(candidate)` rejects wrong-profession and future-version builds,
  applies migrations in ascending version order, merges current defaults, and
  sanitizes common fields against shared GW2 data and the profession catalog.
- `validateBuild(build)` checks the current canonical build without mutating,
  migrating, or sanitizing it and returns `{ valid, errors }`.
- `toApplicationBuild(build)` migrates the build and converts canonical
  stable-ID rotation commands to the legacy name-based entries used by the
  browser shell.

Common normalization covers gear and legacy prefix aliases, weapon handedness,
sigils, relics, runes, food, utility consumables, infusions, three unique
specialization lines with at most one elite, specialization-available and
unique heal/utility/elite skills, assumptions, starting weapon set, target
health and armor, and canonical rotation commands and timing. It also removes
the obsolete `selectedSkillIds` and global `sigils` fields.

Profession modules retain ownership of defaults, ordered version transforms,
and resource-specific fields. `normalizeExtra(build, { saved, defaults })`
normalizes those fields after the common pass; `validateExtra(build)` adds
profession-specific errors. Migrations are keyed by source version and each
advances exactly one version.

### [attributes.ts](js/platform/gw2/attributes.ts)

Profession-neutral common attribute assembly and shared build finalization.
Profession calculators resolve their own ordered trait and skill deltas;
Native professions pass those deltas to
`finalizeBuildAttributes()` to rebuild all derived critical and duration
breakdowns.

### [modifier-rules.ts](js/platform/gw2/modifier-rules.ts)

Validates and compiles declarative profession scalar modifiers into the
existing profession hook contract. It pre-indexes rules by target, applies
ordered flat and multiplicative operations, and rebuilds the outgoing additive
damage bucket once per strike or condition evaluation.

### [damage-modifier-buckets.ts](js/platform/gw2/damage-modifier-buckets.ts)

Low-level GW2 additive outgoing-damage bucket primitive used by the modifier
rule evaluator, including active-sigil inclusion and exclusion.

### [trait-state.ts](js/platform/gw2/trait-state.ts)

Shared stable-ID trait lookup across resolver trait sets and application
configuration shapes.

### [damage.ts](js/platform/gw2/damage.ts)

Damage calculation formulas. Provides strike damage calculation, expected crit multiplier, condition tick damage, and full skill damage breakdowns including per-tick and per-stack effects.

### [weapon-sigils.ts](js/platform/gw2/weapon-sigils.ts)

Weapon sigil management. Normalizes sigil selections, provides sigil lookup by weapon set, and enforces sigil constraints (no duplicate sigils per set). Supports duration bonuses from sigils.

### [event-ownership.ts](js/platform/gw2/event-ownership.ts)

Canonical player, summon, and effect actor classification used by shared
player-only sigil, relic, and trait rules.

---

## Simulation Engine

The simulation is a two-phase pipeline: scheduling creates a versioned timeline, then resolution evaluates it without access to live scheduler state.

Scheduler code lives in `js/platform/engine/`; shared GW2 event construction
and resolution live in `js/platform/gw2/scheduler/` and
`js/platform/gw2/resolver/`.

The shared resolver owns queue draining, strike and condition resolution,
sigils, relics, control, and weapon swaps. A profession registers exclusive
custom event types plus composable reactions to standard events. Mesmer's
resolver handler now contains only Mesmer reactions such as Ineptitude,
critical traits, and Bloodsong.

### Scheduler

- [scheduler.ts](js/platform/engine/scheduler.ts) — default declarative scheduler and profession-hook dispatcher.
- [task-queue.ts](js/platform/engine/task-queue.ts) — deterministic typed
  state-work queue ordered by time, priority, and insertion order.
- [effect-factories.ts](js/platform/engine/effect-factories.ts) — shared
  declarative strike, condition, timeline, control, and custom-effect
  constructors.
- [effect-materializer.ts](js/platform/engine/effect-materializer.ts) — shared
  expansion of canonical effects into damage, condition, and status events.
- [skill-factories.ts](js/platform/engine/skill-factories.ts) — shared
  canonical skill-mechanic constructors.
- [autoattack-chains.ts](js/platform/engine/autoattack-chains.ts) — shared
  ID-based autoattack-chain discovery and indexing used by canonical catalogs.
- [scheduler-state.ts](js/platform/engine/scheduler-state.ts) — profession-neutral mutable state.
- [cooldown-controller.ts](js/platform/engine/cooldown-controller.ts) — shared cooldown and ammo state machine.
- [GW2 scheduler policy](js/platform/gw2/scheduler/policy.ts) — Quickness,
  Alacrity, and starting-weapon-set policy injected into the neutral scheduler.
- Owner-local Core and elite `rules.ts` modules supply availability,
  lifecycle hooks, and task handlers; `state.ts` owns end-state projection.

### Resolver

- [resolve-timeline.ts](js/platform/gw2/resolver/resolve-timeline.ts) — shared resolver composition and result builder.
- [runtime-state.ts](js/platform/gw2/resolver/runtime-state.ts) — common damage, condition, relic, sigil, and reporting state.
- [event-loop.ts](js/platform/gw2/resolver/event-loop.ts) — ordered dispatch, combat bounds, and target death.
- [event-handlers.ts](js/platform/gw2/resolver/event-handlers.ts) — common damage, condition, control, sigil, relic, and weapon-swap behavior.
- [hit-resolution.ts](js/platform/gw2/resolver/hit-resolution.ts) — shared strike resolution with injected profession modifiers.
- [weapon-strength-resolution.ts](js/platform/gw2/resolver/weapon-strength-resolution.ts)
  — deterministic midpoint or cached per-activation stochastic strength
  resolution and diagnostics.
- [condition-resolution.ts](js/platform/gw2/resolver/condition-resolution.ts) — shared condition applications and ticks.
- Owner-local Core and elite resolver modules supply profession reactions.

### Shared Platform Simulation

- [event-queue.ts](js/platform/engine/event-queue.ts) — stable chronological and priority ordering.
- [scheduled-event-stream.ts](js/platform/engine/scheduled-event-stream.ts) —
  canonical scheduler-to-resolver boundary.
- [clock.ts](js/platform/engine/clock.ts) — shared floating-point timeline tolerance.
- [target-state.ts](js/platform/gw2/target-state.ts) — normalizes target-condition assumptions.

### Declarative Profession Mechanics

Every family module uses the same roles for shared concepts:

- `module.ts` declares `data`, `state`, `mechanics`, and `presentation` with
  `defineNativeModule()`; it does not import the root catalog.
- `state.ts` owns scheduler/resolver state construction, snapshots, and
  end-state projection.
- `rules.ts` owns predicates, `mechanics.modifiers` declarative scalar rules,
  availability, cast rules, scheduler hooks, and exceptional ordered
  transforms. Modifier rules are not split into `attribute-rules.ts`.
- `build-attributes.ts` owns profession trait deltas and conversions before
  shared finalization.
- `data/<profession>-api-metadata.js` contains generated identity and
  presentation metadata only.
- `data/trait-coverage.ts` records one validated disposition per catalog trait.
- `skills.ts` owns authoritative local mechanics; a root
  `mechanics/skill-mechanics.ts` may remain as an inert compatibility view.
- `handlers.ts` owns scheduler-phase skill augment/replace strategy composition
  only. Lifecycle rules and task handlers do not import it.
- `resolver.ts` owns resolver-phase reactions and custom event handlers.
- `traits.ts` owns imperative trait checks, procs, emitted effects, and trait
  lifecycle behavior. Skill handlers and resolver modules may delegate to or
  re-export trait-owned callbacks. Declarative scalar modifier predicates stay
  in `rules.ts`.
- `mechanics.ts` owns local triggered effects and state-machine formulas.
- Profession-unique mechanic files retain bespoke names such as `shroud.ts`,
  `tomes.ts`, or `photon-forge.ts`.
- `catalog-data.ts` contains inert generated inputs and exceptional ownership
  options; `catalog.ts` exports the complete catalog derived from modules.

Each family `definition.ts` resolves through the native authoring layer and
then `platform/engine/profession.ts`. The engine composes the complete
application UI from Core plus the selected elite and creates a separate
executable runtime. Scheduler snapshots remain
profession-internal; `resources.projectEndState` publishes an explicit
allowlisted public state object.

`platform/gw2/attribute-provenance.ts` defines the shared marker that tells
runtime hooks whether static profession rules were already applied by browser
build calculation and which weapon set supplied those attributes.

### Family source discovery

`tsconfig.build.json` and `jsconfig.typed.json` include `js/**/*.ts` instead of
enumerating profession files. New TypeScript module files are built and checked
automatically. `scripts/build/check-dist.mjs` verifies that every non-declaration
TypeScript source has one compiled output, that no generated JavaScript sits
beside a TypeScript source, and that `dist` has no stale output.

## Test fixtures

Testing utilities and harnesses.

### [fixture-harness-core.js](tests/helpers/fixture-harness-core.js)

Core test harness. Provides default simulation config and build factory for unit tests.

### [fixture-harness-page.js](tests/browser/fixture-harness-page.js)

Page fixture harness. DOM utilities and page initialization helpers for integration tests.

### [browser-interaction-fixture.js](tests/browser/browser-interaction-fixture.js)

Browser interaction testing. Simulates user UI interactions (clicks, form changes) for end-to-end test scenarios.

---

## Data Flow Architecture

```text
UI build and rotation
    ↓
createProfessionRuntime → simulateGw2
    ↓
platform/engine/scheduler
    ├→ common cooldown, ammo, cast lifecycle, and typed task queue
    ├→ profession cast rules and scheduler hooks
    └→ canonical scheduled-event stream
    ↓
platform/gw2/resolver
    ├→ shared attributes, hits, conditions, sigils, relics, and target state
    └→ profession attribute hooks, event handlers, and reactions
    ↓
canonical result and endState.profession
    ↓
shared result, chart, timeline, and event-log renderers
```

---

## Key Concepts

### Build

Complete character configuration: gear/prefixes, weapons/sigils, runes/relics, food/utility, infusions, trait selections, skill selections, assumptions (boons/target state).

### Rotation

Ordered sequence of skill activations with optional timing offsets, representing player action sequence.

### Simulation Pass

Single execution of a rotation under specific config: determines when skills activate, calculates damage, applies conditions, tracks cooldowns.

### Attributes

Derived stats from build: Power, Precision, Ferocity, Expertise, Concentration, and derived metrics like Critical Chance, Critical Damage, Duration bonuses.

### Event

Atomic action with timestamp: action (skill cast), cooldown, resource change, condition, damage, trait proc. Events flow through scheduler → resolver pipeline.

### Resolver

Post-scheduler phase that converts timed events into damage numbers using calculated attributes and condition formulas.

---

## File Organization Summary

| Path                                                              | Purpose                                                                               |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `js/app/`                                                         | Profession-neutral browser shell, composition, and orchestration                      |
| `js/platform/engine/`                                             | Shared scheduling, event queue, and simulation primitives                             |
| `js/platform/gw2/`                                                | Shared GW2 formulas, data, scheduler events, resolver, gear, relics, and target state |
| `js/platform/ui/`                                                 | Shared palette/resource/timeline/log/result/chart view-model contracts                |
| `js/professions/*/data/`                                          | Profession-owned catalogs, mechanics data, traits, and loaders                        |
| `js/professions/*/core/`, `.../specializations/`                  | Core and per-elite vertical slices: skills, rules, mechanics, resolver, and UI        |
| `js/professions/elementalist/{sim,optimizer}/`                    | Ported Elementalist simulator and gear optimizer                                      |
| `Builds/elementalist/manifest.json`, `Builds/elementalist/*.json` | Elementalist build presets                                                            |
| `Builds/<profession>/`                                            | Native profession builds and `manifest.json`                                          |
| `Rotations/`, `Rotations/<profession>/`                           | Elementalist and native profession rotation examples                                  |
| `js/professions/elementalist/legacy/data/csv/`                    | Legacy Elementalist skill and hit CSVs                                                |
| `tests/browser/`                                                  | Browser interaction fixtures                                                          |
| `tests/helpers/`                                                  | Shared testing utilities                                                              |
