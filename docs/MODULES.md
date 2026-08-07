# Simulator Modules Documentation

Overview of the JavaScript modules in the combat simulator, organized by
functionality. The shared shell is profession-neutral; each profession supplies
its own catalog and mechanics. Native professions also supply an application
definition for the shared browser shell.

---

## Application Layer (`js/app/`)

Profession-neutral browser shell: UI rendering, state management, and user
interaction orchestration. A profession application adapter injects its catalog,
codec, storage key, renderer hooks, and worker.

### Entry and controller

- [app.js](js/app/app.js) is the browser entry point and only registers the
  `DOMContentLoaded` bootstrap.
- [bootstrap.js](js/app/bootstrap.js) resolves the page's profession adapter
  and initializes the application.
- [profession-app.js](js/app/profession-app.js) exports the thin
  `ProfessionApp` lifecycle coordinator. Rendering and background analysis are
  delegated to their owning feature modules.

### Profession `definition.js` and `app/app-definition.js`

Each native profession has two deliberately separate composition boundaries:

- `definition.js` exports the stable profession source. For a family this is
  an application contract plus `resolveRuntime(config)`; executable resources,
  rules, hooks, and registries exist only on the resolved runtime.
- `app/app-definition.js` composes that contract for the shared browser shell.
  It constructs the build attribute calculator and application runtime, then
  supplies persistence metadata, import/export filenames, selector behavior,
  build-to-simulation mapping, and the application adapter.

Keeping browser composition out of `definition.js` lets simulations and other
engine consumers load a profession without pulling in application rendering,
storage, and modifier-contribution dependencies. Elementalist remains a
standalone application with its profession-owned scheduler and resolver.

Engineer, Guardian, Mesmer, Necromancer, Revenant, and Thief share the family
boundary. `core/` owns always-active behavior;
`specializations/<elite>/` owns each elite vertical slice. A slice normally
contains `module`, `state`, `skills`, `handlers`, `mechanics`, `rules`, and
`ui`. `modules` owns the single Core-first module tuple; `family` passes it to
`defineNativeProfession()`. The full application catalog and active runtime
fragments are derived from those modules. `platform/gw2/native-profession.ts`
owns the typed authoring API and catalog derivation, while
`platform/engine/profession.ts` remains responsible for hook composition,
cached runtime resolution, and generic application UI dispatch.

### Profession composition (`js/app/profession/`)

[registry.js](js/app/profession/registry.js) is the single lazy manifest for
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

[selector.js](js/app/profession/selector.js) provides registry-driven
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

- `create-adapter.js` and `create-runtime.js` build a profession's browser
  adapter and simulation runtime.
- `define-app.js` composes native profession application definitions.
- `assumptions.js` and `slot-loadout.js` own shared profession-facing UI
  contracts.

### Build UI (`js/app/build/`)

Build configuration is grouped by feature:

- `persistence.js` creates, loads, saves, and replaces application builds.
- `files.js` handles build and rotation JSON import/export.
- `options.js` owns shared option metadata and HTML option generation.
- `selection.js` normalizes selectable slot skills.
- `gear-panel.js`, `traits-panel.js`, `attributes-panel.js`,
  `skills-panel.js`, and `assumptions-panel.js` render and bind their own DOM
  panels.
- `presets.js` owns profession build templates, paired build/rotation loading,
  partial-load actions, and undo; `page-controls.js` owns persistent page
  controls.

### Rotation UI (`js/app/rotation/`)

Rotation-builder behavior is split into explicit models and views:

- `index.js` orchestrates the complete rotation builder.
- `actions.js` mutates rotation entries.
- `palette-model.js` and `palette-view.js` own palette state and rendering.
- `resource-view.js` renders starting-resource controls.
- `timeline-model.js` builds rows, markers, and proc groups;
  `timeline-view.js` renders and binds the timeline.
- `event-log.js` and `warnings.js` transform and mount diagnostics.
- `result-model.js` creates metrics, chart series, and breakdown rows;
  `result-view.js` mounts results.
- `icons.js` resolves palette, proc, and result icons.

These modules compose the generic widgets in `js/platform/ui/`; platform UI
does not depend on the application layer.

### Simulation application services (`js/app/simulation/`)

- `config.js` builds the shared GW2 simulation configuration.
- `randomness.js` owns the persisted deterministic/distribution mode shared by
  every native profession.
- `random-distribution.js` and `modifier-contributions.js` contain pure
  partitioning and analysis functions.
- Their `*-runner.js` modules own timers, request IDs, and worker pools instead
  of storing background-job state on `ProfessionApp`.
- Their `*-worker.js` modules are the browser worker entry points.

Per-profession build-to-simulation mapping and modifier candidates remain under
each profession's `app/` directory.

---

## Data ownership

Static Guild Wars 2 game data and lookups live with their owning layer.

- Generated profession API metadata lives in each profession's
  `data/<profession>-api-metadata.js`; authoritative formulas live in
  owner-local Core or elite `skills.js`. A root
  `mechanics/skill-mechanics.js` is an inert compatibility aggregate only.
- [Shared gear data](js/platform/gw2/gear-data.js) contains equipment,
  consumable, infusion, weapon, sigil, rune, and relic lookups.
- [weapon-strength.js](js/platform/gw2/weapon-strength.js) owns canonical
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
catalogs and validates collisions and handler ownership. Root `catalog.js`
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

### [build-codec.js](js/platform/gw2/build-codec.js)
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

### [attributes.js](js/platform/gw2/attributes.js)
Profession-neutral common attribute assembly and shared build finalization.
Profession calculators resolve their own ordered trait and skill deltas;
Native professions pass those deltas to
`finalizeBuildAttributes()` to rebuild all derived critical and duration
breakdowns.

### [modifier-rules.js](js/platform/gw2/modifier-rules.js)
Validates and compiles declarative profession scalar modifiers into the
existing profession hook contract. It pre-indexes rules by target, applies
ordered flat and multiplicative operations, and rebuilds the outgoing additive
damage bucket once per strike or condition evaluation.

### [damage-modifier-buckets.js](js/platform/gw2/damage-modifier-buckets.js)
Low-level GW2 additive outgoing-damage bucket primitive used by the modifier
rule evaluator, including active-sigil inclusion and exclusion.

### [trait-state.js](js/platform/gw2/trait-state.js)
Shared stable-ID trait lookup across resolver trait sets and application
configuration shapes.

### [damage.js](js/platform/gw2/damage.js)
Damage calculation formulas. Provides strike damage calculation, expected crit multiplier, condition tick damage, and full skill damage breakdowns including per-tick and per-stack effects.

### [weapon-sigils.js](js/platform/gw2/weapon-sigils.js)
Weapon sigil management. Normalizes sigil selections, provides sigil lookup by weapon set, and enforces sigil constraints (no duplicate sigils per set). Supports duration bonuses from sigils.

### [event-ownership.js](js/platform/gw2/event-ownership.js)
Canonical player, summon, and effect actor classification used by shared
player-only sigil, relic, and trait rules.

---

## Simulation Engine

The simulation is a two-phase pipeline: scheduling creates a versioned timeline, then resolution evaluates it without access to live scheduler state.

The obsolete `js/sim/` compatibility tree has been removed. Scheduler code
uses `js/platform/engine/`; shared GW2 event construction and resolution use
`js/platform/gw2/scheduler/` and `js/platform/gw2/resolver/`.

The shared resolver owns queue draining, strike and condition resolution,
sigils, relics, control, and weapon swaps. A profession registers exclusive
custom event types plus composable reactions to standard events. Mesmer's
resolver handler now contains only Mesmer reactions such as Ineptitude,
critical traits, and Bloodsong.

### Scheduler

- [scheduler.js](js/platform/engine/scheduler.js) — default declarative scheduler and profession-hook dispatcher.
- [task-queue.js](js/platform/engine/task-queue.js) — deterministic typed
  state-work queue ordered by time, priority, and insertion order.
- [effect-factories.js](js/platform/engine/effect-factories.js) — shared
  declarative strike, condition, timeline, control, and custom-effect
  constructors.
- [effect-materializer.js](js/platform/engine/effect-materializer.js) — shared
  expansion of canonical effects into damage, condition, and status events.
- [skill-factories.js](js/platform/engine/skill-factories.js) — shared
  canonical skill-mechanic constructors.
- [autoattack-chains.js](js/platform/engine/autoattack-chains.js) — shared
  ID-based autoattack-chain discovery and indexing used by canonical catalogs.
- [scheduler-state.js](js/platform/engine/scheduler-state.js) — profession-neutral mutable state.
- [cooldown-controller.js](js/platform/engine/cooldown-controller.js) — shared cooldown and ammo state machine.
- [GW2 scheduler policy](js/platform/gw2/scheduler/policy.js) — Quickness,
  Alacrity, and starting-weapon-set policy injected into the neutral scheduler.
- Owner-local Core and elite `rules.js` modules supply availability,
  lifecycle hooks, task handlers, and end-state projection.

### Resolver

- [resolve-timeline.js](js/platform/gw2/resolver/resolve-timeline.js) — shared resolver composition and result builder.
- [runtime-state.js](js/platform/gw2/resolver/runtime-state.js) — common damage, condition, relic, sigil, and reporting state.
- [event-loop.js](js/platform/gw2/resolver/event-loop.js) — ordered dispatch, combat bounds, and target death.
- [event-handlers.js](js/platform/gw2/resolver/event-handlers.js) — common damage, condition, control, sigil, relic, and weapon-swap behavior.
- [hit-resolution.js](js/platform/gw2/resolver/hit-resolution.js) — shared strike resolution with injected profession modifiers.
- [weapon-strength-resolution.js](js/platform/gw2/resolver/weapon-strength-resolution.js)
  — deterministic midpoint or cached per-activation stochastic strength
  resolution and diagnostics.
- [condition-resolution.js](js/platform/gw2/resolver/condition-resolution.js) — shared condition applications and ticks.
- Owner-local Core and elite resolver modules supply profession reactions.

### Shared Platform Simulation

- [event-queue.js](js/platform/engine/event-queue.js) — stable chronological and priority ordering.
- [scheduled-event-stream.js](js/platform/engine/scheduled-event-stream.js) —
  canonical scheduler-to-resolver boundary.
- [clock.js](js/platform/engine/clock.js) — shared floating-point timeline tolerance.
- [target-state.js](js/platform/gw2/target-state.js) — normalizes target-condition assumptions.

### Declarative Profession Mechanics

Every family module uses the same roles for shared concepts:

- `module.js` declares `data`, `state`, `mechanics`, and `presentation` with
  `defineNativeModule()`; it does not import the root catalog.
- `rules.js` owns predicates, declarative scalar modifier rules, cast rules,
  scheduler hooks, and exceptional ordered transforms.
- `build-attributes.js` owns profession trait deltas and conversions before
  shared finalization.
- `data/<profession>-api-metadata.js` contains generated identity and
  presentation metadata only.
- `data/trait-coverage.js` records one validated disposition per catalog trait.
- `skills.js` owns authoritative local mechanics; a root
  `mechanics/skill-mechanics.js` may remain as an inert compatibility view.
- `mechanics.js` owns local triggered effects and state-machine formulas.
- `catalog-data.js` contains inert generated inputs and exceptional ownership
  options; `catalog.js` exports the complete catalog derived from modules.
- `handlers.js` owns local augment/replace strategies and event/task
  registries.

Each family `definition.js` resolves through the native authoring layer and
then `platform/engine/profession.js`. The engine composes the complete
application UI from Core plus the selected elite and creates a separate
executable runtime. Scheduler snapshots remain
profession-internal; `resources.projectEndState` publishes an explicit
allowlisted public state object.

`platform/gw2/attribute-provenance.js` defines the shared marker that tells
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

| Path | Purpose |
|------|---------|
| `js/app/` | Profession-neutral browser shell, composition, and orchestration |
| `js/platform/engine/` | Shared scheduling, event queue, and simulation primitives |
| `js/platform/gw2/` | Shared GW2 formulas, data, scheduler events, resolver, gear, relics, and target state |
| `js/platform/ui/` | Shared palette/resource/timeline/log/result/chart view-model contracts |
| `js/professions/*/data/` | Profession-owned catalogs, mechanics data, traits, and loaders |
| `js/professions/*/mechanics/` | Profession rules and skill definitions (per profession) |
| `js/professions/elementalist/{sim,optimizer}/` | Ported Elementalist simulator and gear optimizer |
| `Builds/manifest.json`, `Builds/*.json` | Elementalist build presets |
| `Builds/<profession>/` | Native profession builds and `manifest.json` |
| `Rotations/`, `Rotations/<profession>/` | Elementalist and native profession rotation examples |
| `csv input/` | Elementalist skill and hit CSVs |
| `tests/browser/` | Browser interaction fixtures |
| `tests/helpers/` | Shared testing utilities |
