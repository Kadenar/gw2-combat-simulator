# Simulator modules

Directory reference for the TypeScript combat simulator: what each module and
folder owns. The shared shell is profession-neutral; each profession supplies
its own catalog and mechanics, and native professions add an application
definition for the shared browser shell.

Concepts, contracts, dependency rules, and the profession authoring workflow
live in [ARCHITECTURE.md](./ARCHITECTURE.md); this file does not repeat them. See
its [Key concepts](./ARCHITECTURE.md#key-concepts) glossary for Build, Rotation,
Attributes, Event, and Resolver definitions.

## Contents

- [Map](#map)
- [Application layer (`js/app/`)](#application-layer-jsapp)
- [Shared GW2 formulas and data (`js/platform/gw2/`)](#shared-gw2-formulas-and-data-jsplatformgw2)
- [Simulation pipeline](#simulation-pipeline)
- [Profession family slices (`js/professions/*/`)](#profession-family-slices-jsprofessions)
- [Tests](#tests)

## Map

| Path                                             | Purpose                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `js/app/`                                        | Profession-neutral browser shell, composition, and orchestration                      |
| `js/platform/engine/`                            | Shared scheduling, event queue, and simulation primitives                             |
| `js/platform/gw2/`                               | Shared GW2 formulas, data, scheduler events, resolver, gear, relics, and target state |
| `js/platform/ui/`                                | Shared palette/resource/timeline/log/result/chart view-model contracts                |
| `js/professions/*/data/`                         | Profession-owned generated metadata, traits, coverage, and stable IDs                 |
| `js/professions/*/core/`, `.../specializations/` | Core and per-elite vertical slices: skills, rules, mechanics, resolver, and UI        |
| `Builds/<profession>/`                           | Canonical native-profession builds and `manifest.json`                                |
| `Rotations/<profession>/`                        | Native-profession rotation examples                                                   |
| `reference-repos/Elementalist-Simulator/`        | Ignored upstream Elementalist reference clone used by audit scripts                   |
| `tests/browser/`                                 | Browser interaction fixtures                                                           |
| `tests/helpers/`                                 | Shared testing utilities                                                               |

Data flow through the layers:

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

Layer dependency rules are defined in
[ARCHITECTURE.md](./ARCHITECTURE.md#dependency-rules).

## Application layer (`js/app/`)

Profession-neutral browser shell: UI rendering, state management, and user
interaction orchestration. A profession application adapter injects its catalog,
codec, storage key, renderer hooks, and worker.

### Entry and controller

| Module                                                       | Owns                                                                                              |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| [app.ts](../../js/app/app.ts)                                | Browser entry point; registers the `DOMContentLoaded` bootstrap only.                             |
| [bootstrap.ts](../../js/app/bootstrap.ts)                    | Resolves the page's profession adapter and initializes the application.                           |
| [profession-app.ts](../../js/app/profession-app.ts)          | Thin `ProfessionApp` lifecycle coordinator; rendering and background analysis delegate to owners. |

Each native profession keeps two separate composition boundaries: `definition.ts`
(stable, engine-facing profession source) and `app/app-definition.ts` (browser
composition — build calculator, runtime, persistence, filenames, selectors, and
the application adapter). Keeping browser composition out of `definition.ts` lets
engine consumers load a profession without rendering and storage dependencies.
The rationale lives in
[ARCHITECTURE.md](./ARCHITECTURE.md#declarative-profession-mechanics-layout).

### Profession composition (`js/app/profession/`)

[registry.ts](../../js/app/profession/registry.ts) is the single lazy manifest for
every profession. Each entry supplies a stable ID, display metadata, route,
optional theme class, and dynamic loaders for the profession contract and
shared-shell app adapter. Entries are validated for unique IDs and routes at load
and shallow-frozen. Loader paths are explicit so they stay statically
discoverable; importing the registry does not load implementations. To add a
profession, add one entry with its page metadata and loaders.

| Export                                                     | Returns                                                                          |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `professionRegistry`                                       | All profession routes, each bootstrapped through the shared-shell app adapter.   |
| `professionOptions`, `PROFESSION_ROUTES`                   | Frozen projections for UI and compatibility consumers.                           |
| `getProfessionEntry()`, `professionRoute()`                | Synchronous metadata/route lookup; unknown IDs give `null` and `index.html`.     |
| `loadProfession()`, `loadProfessionAppAdapter()`           | Lazy loaders; both return `null` for unknown IDs.                                 |

[selector.ts](../../js/app/profession/selector.ts) provides registry-driven
landing-page and header navigation. `bindProfessionSelector()` renders cards into
an optional `[data-profession-grid]`, rebuilds the optional `#profession-select`,
applies the active entry's theme class, and navigates on change. The active ID is
read from `body[data-profession]`, then the selector's `data-active-profession`;
unknown or absent IDs produce a disabled placeholder. The module auto-binds in a
browser and is inert without `document`; missing grid/selector elements are valid
so the same script serves landing and simulator pages. `PROFESSION_ROUTES` and
`professionRoute()` are re-exported for compatibility, sourced from the registry.

| Module                | Owns                                                             |
| --------------------- | --------------------------------------------------------------- |
| `create-adapter.ts`   | Builds a profession's browser adapter.                          |
| `create-runtime.ts`   | Builds a profession's simulation runtime.                       |
| `define-app.ts`       | Composes native profession application definitions.             |
| `assumptions.ts`      | Shared profession-facing assumptions UI contract.              |
| `slot-loadout.ts`     | Shared profession-facing slot-loadout UI contract.             |

### Build UI (`js/app/build/`)

| Module                                                                                                 | Owns                                                                                |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `persistence.ts`                                                                                       | Create, load, save, and replace application builds.                                 |
| `files.ts`                                                                                             | Build and rotation JSON import/export.                                              |
| `options.ts`                                                                                           | Shared option metadata and HTML option generation.                                  |
| `selection.ts`                                                                                         | Normalizes selectable slot skills.                                                  |
| `gear-panel.ts`, `traits-panel.ts`, `attributes-panel.ts`, `skills-panel.ts`, `assumptions-panel.ts`  | Render and bind their own DOM panels.                                               |
| `presets.ts`                                                                                           | Profession build templates, paired build/rotation loading, partial-load, and undo.  |
| `page-controls.ts`                                                                                     | Persistent page controls.                                                          |

### Rotation UI (`js/app/rotation/`)

Rotation-builder behavior is split into explicit models and views. These modules
compose the generic widgets in `js/platform/ui/`; platform UI does not depend on
the application layer.

| Module                                | Owns                                                        |
| ------------------------------------- | ----------------------------------------------------------- |
| `index.ts`                            | Orchestrates the complete rotation builder.                 |
| `actions.ts`                          | Mutates rotation entries.                                   |
| `palette-model.ts`, `palette-view.ts` | Palette state and rendering.                                |
| `resource-view.ts`                    | Renders starting-resource controls.                         |
| `timeline-model.ts`, `timeline-view.ts` | Builds rows/markers/proc groups; renders and binds them.  |
| `event-log.ts`, `warnings.ts`         | Transform and mount diagnostics.                            |
| `result-model.ts`, `result-view.ts`   | Metrics, chart series, breakdown rows; mounts results.      |
| `icons.ts`                            | Resolves palette, proc, and result icons.                   |

### Simulation application services (`js/app/simulation/`)

Per-profession build-to-simulation mapping and modifier candidates remain under
each profession's `app/` directory.

| Module                                              | Owns                                                                          |
| --------------------------------------------------- | ----------------------------------------------------------------------------- |
| `config.ts`                                         | Builds the shared GW2 simulation configuration.                               |
| `randomness.ts`                                     | Persisted deterministic/distribution mode shared by every native profession.  |
| `random-distribution.ts`, `modifier-contributions.ts` | Pure partitioning and analysis functions.                                  |
| `*-runner.ts`                                       | Own timers, request IDs, and worker pools (not stored on `ProfessionApp`).    |
| `*-worker.ts`                                       | Browser worker entry points.                                                  |

## Shared GW2 formulas and data (`js/platform/gw2/`)

Attribute calculations, damage formulas, and the native-profession authoring
layer.

### Data ownership

Static Guild Wars 2 game data and lookups live with their owning layer.

- Generated profession API metadata lives in each profession's
  `data/<profession>-api-metadata.js`; authoritative formulas live in owner-local
  Core or elite `skills.ts`. A root `mechanics/skill-mechanics.ts` is an inert
  compatibility aggregate only.
- [gear-data.ts](../../js/platform/gw2/gear-data.ts) — equipment, consumable,
  infusion, weapon, sigil, rune, and relic lookups.
- [weapon-strength.ts](../../js/platform/gw2/weapon-strength.ts) — canonical
  min/max weapon, non-weapon, bundle, transform, and shroud strength profiles.

### Authoring and persistence

[native-profession.ts](../../js/platform/gw2/native-profession.ts) is the strongly
typed native-profession authoring layer. `defineNativeModule()` groups one
vertical slice as `data`, `state`, `mechanics`, and `presentation`;
`defineNativeProfession()` requires a Core-first module tuple and compiles to the
engine family contract. `createNativeModuleData()` selects generated identity for
one module and combines it with local mechanics/handlers/traits/weapons/chains;
`assembleNativeApplicationCatalog()` derives the full build/editor catalog and the
Core-plus-active-specialization runtime catalogs, validating collisions and
handler ownership. Root `catalog.ts` files stay stable exports that modules never
import, avoiding a catalog-to-module cycle. Phase-explicit helpers
(`skillAvailability()`, `afterSkillEffects()`, `onResolved*()`, `augmentSkill()`,
`replaceSkill()`) and the low-level `mechanics.*Hooks` escape hatches are
documented in
[ARCHITECTURE.md](./ARCHITECTURE.md#phase-explicit-native-helpers).

[build-codec.ts](../../js/platform/gw2/build-codec.ts) is the factory for native
build persistence. `createGw2BuildCodec()` takes a profession ID, schema version,
catalog, defaults factory, and optional migration/normalization/validation hooks,
and returns a frozen object with three operations:

- `migrateBuild(candidate)` — rejects wrong-profession and future-version builds,
  applies migrations in ascending order, merges current defaults, and sanitizes
  common fields against shared GW2 data and the catalog.
- `validateBuild(build)` — checks the canonical build without mutating it;
  returns `{ valid, errors }`.
- `toApplicationBuild(build)` — migrates, then converts canonical stable-ID
  rotation commands to the legacy name-based entries used by the browser shell.

Common normalization covers gear/prefix aliases, weapon handedness, sigils,
relics, runes, food, utility consumables, infusions, three specialization lines
(≤1 elite), specialization-available and unique heal/utility/elite skills,
assumptions, starting weapon set, target health/armor, and canonical rotation
commands/timing; it also drops the obsolete `selectedSkillIds` and global `sigils`
fields. Profession modules keep defaults, ordered version transforms, and
resource-specific fields: `normalizeExtra(build, { saved, defaults })` runs after
the common pass, and `validateExtra(build)` adds profession-specific errors.

### Formula and modifier primitives

| Module                                                                                   | Owns                                                                                                             |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [attributes.ts](../../js/platform/gw2/attributes.ts)                                     | Common attribute assembly and `finalizeBuildAttributes()`, rebuilding derived critical and duration breakdowns. |
| [modifier-rules.ts](../../js/platform/gw2/modifier-rules.ts)                             | Compiles declarative scalar modifiers; ordered flat/multiplicative ops; rebuilds the additive damage bucket.    |
| [damage-modifier-buckets.ts](../../js/platform/gw2/damage-modifier-buckets.ts)           | Low-level additive outgoing-damage bucket primitive, incl. active-sigil inclusion/exclusion.                    |
| [trait-state.ts](../../js/platform/gw2/trait-state.ts)                                   | Shared stable-ID trait lookup across resolver trait sets and application config.                                |
| [damage.ts](../../js/platform/gw2/damage.ts)                                             | Strike damage, expected crit multiplier, condition tick damage, and full skill damage breakdowns.               |
| [weapon-sigils.ts](../../js/platform/gw2/weapon-sigils.ts)                               | Normalizes sigil selections, lookup by weapon set, no-duplicate constraint, and duration bonuses.               |
| [event-ownership.ts](../../js/platform/gw2/event-ownership.ts)                           | Canonical player/summon/effect actor classification for player-only sigil, relic, and trait rules.              |

## Simulation pipeline

Two-phase: scheduling creates a versioned timeline, then resolution evaluates it
without access to live scheduler state. Scheduler code lives in
`js/platform/engine/`; shared GW2 event construction and resolution live in
`js/platform/gw2/scheduler/` and `js/platform/gw2/resolver/`. The shared resolver
owns queue draining, strike/condition resolution, sigils, relics, control, and
weapon swaps; a profession registers exclusive custom event types plus composable
reactions to standard events.

### Scheduler

| Module                                                                              | Owns                                                                                  |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [scheduler.ts](../../js/platform/engine/scheduler.ts)                               | Default declarative scheduler and profession-hook dispatcher.                         |
| [task-queue.ts](../../js/platform/engine/task-queue.ts)                             | Deterministic typed state-work queue ordered by time, priority, and insertion order.  |
| [effect-factories.ts](../../js/platform/engine/effect-factories.ts)                 | Shared declarative strike/condition/timeline/control/custom-effect constructors.      |
| [effect-materializer.ts](../../js/platform/engine/effect-materializer.ts)           | Expansion of canonical effects into damage, condition, and status events.             |
| [skill-factories.ts](../../js/platform/engine/skill-factories.ts)                   | Shared canonical skill-mechanic constructors.                                        |
| [autoattack-chains.ts](../../js/platform/engine/autoattack-chains.ts)               | ID-based autoattack-chain discovery and indexing for canonical catalogs.              |
| [scheduler-state.ts](../../js/platform/engine/scheduler-state.ts)                   | Profession-neutral mutable state.                                                    |
| [cooldown-controller.ts](../../js/platform/engine/cooldown-controller.ts)           | Shared cooldown and ammo state machine.                                              |
| [scheduler/policy.ts](../../js/platform/gw2/scheduler/policy.ts)                    | Quickness/Alacrity/starting-weapon-set policy injected into the neutral scheduler.    |
| Owner-local Core/elite `rules.ts`, `state.ts`                                        | Availability, lifecycle hooks, task handlers; `state.ts` owns end-state projection.   |

### Resolver

| Module                                                                                                       | Owns                                                                             |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| [resolve-timeline.ts](../../js/platform/gw2/resolver/resolve-timeline.ts)                                    | Shared resolver composition and result builder.                                  |
| [runtime-state.ts](../../js/platform/gw2/resolver/runtime-state.ts)                                          | Common damage, condition, relic, sigil, and reporting state.                     |
| [event-loop.ts](../../js/platform/gw2/resolver/event-loop.ts)                                                | Ordered dispatch, combat bounds, and target death.                               |
| [event-handlers.ts](../../js/platform/gw2/resolver/event-handlers.ts)                                        | Common damage, condition, control, sigil, relic, and weapon-swap behavior.       |
| [hit-resolution.ts](../../js/platform/gw2/resolver/hit-resolution.ts)                                        | Shared strike resolution with injected profession modifiers.                     |
| [weapon-strength-resolution.ts](../../js/platform/gw2/resolver/weapon-strength-resolution.ts)                | Deterministic-midpoint or cached per-activation stochastic strength + diagnostics. |
| [condition-resolution.ts](../../js/platform/gw2/resolver/condition-resolution.ts)                            | Shared condition applications and ticks.                                         |
| Owner-local Core/elite resolver modules                                                                      | Profession reactions.                                                            |

### Shared timeline primitives

| Module                                                                              | Owns                                                        |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| [event-queue.ts](../../js/platform/engine/event-queue.ts)                           | Stable chronological and priority ordering.                 |
| [scheduled-event-stream.ts](../../js/platform/engine/scheduled-event-stream.ts)     | Canonical scheduler-to-resolver boundary.                   |
| [clock.ts](../../js/platform/engine/clock.ts)                                        | Shared floating-point timeline tolerance.                   |
| [target-state.ts](../../js/platform/gw2/target-state.ts)                             | Normalizes target-condition assumptions.                    |

### Family source discovery

`tsconfig.build.json` and `jsconfig.typed.json` include `js/**/*.ts` instead of
enumerating profession files, so new TypeScript modules build and check
automatically. `scripts/build/check-dist.mjs` verifies that every
non-declaration TypeScript source has one compiled output, that no generated
JavaScript sits beside a TypeScript source, and that `dist` has no stale output.

## Profession family slices (`js/professions/*/`)

Every native profession (Elementalist, Engineer, Guardian, Mesmer, Necromancer,
Ranger, Revenant, Thief, Warrior) shares one layout: `core/` owns always-active
behavior; `specializations/<elite>/` owns each elite vertical slice. Each family
module uses the same roles:

| Role                                        | Owns                                                                                                     |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `module.ts`                                 | Declares `data`, `state`, `mechanics`, `presentation` via `defineNativeModule()`; no root-catalog import. |
| `state.ts`                                  | Scheduler/resolver state construction, snapshots, and end-state projection.                              |
| `rules.ts`                                  | Predicates, `mechanics.modifiers` scalar rules, availability, cast rules, scheduler hooks, transforms.   |
| `build-attributes.ts`                       | Profession trait deltas and conversions before shared finalization.                                      |
| `data/<profession>-api-metadata.js`         | Generated identity and presentation metadata only.                                                       |
| `data/trait-coverage.ts`                    | One validated disposition per catalog trait.                                                             |
| `skills.ts`                                 | Authoritative local mechanics (root `mechanics/skill-mechanics.ts` may remain as an inert view).         |
| `handlers.ts`                               | Scheduler-phase skill augment/replace strategy composition only.                                         |
| `resolver.ts`                               | Resolver-phase reactions and custom event handlers.                                                      |
| `traits.ts`                                 | Imperative trait checks, procs, emitted effects, and trait lifecycle; handlers/resolver may delegate.    |
| `mechanics.ts`                              | Local triggered effects and state-machine formulas.                                                      |
| Bespoke files (`shroud.ts`, `tomes.ts`, …)  | Profession-unique mechanics keep descriptive filenames.                                                  |
| `catalog-data.ts`, `catalog.ts`             | Inert generated inputs/ownership options; the complete catalog derived from modules.                     |

A slice normally contains `module`, `state`, `skills`, `resolver`, `mechanics`,
`rules`, and `ui`; it adds `handlers` only when it contributes local skill
handlers and `traits` only for imperative trait behavior. Empty handler
placeholders are not used. `modules` owns the single Core-first module tuple that
`family` passes to `defineNativeProfession()`.

Each family `definition.ts` resolves through the native authoring layer and then
`platform/engine/profession.ts`, which composes the complete application UI from
Core plus the selected elite and creates a separate executable runtime. Scheduler
snapshots stay profession-internal; `resources.projectEndState` publishes an
allowlisted public state object.
[attribute-provenance.ts](../../js/platform/gw2/attribute-provenance.ts) marks
whether static profession rules were already applied by browser build calculation
and which weapon set supplied those attributes.

## Tests

| Fixture                                                                              | Purpose                                                                     |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| [fixture-harness-core.js](../../tests/helpers/fixture-harness-core.js)               | Core harness: default simulation config and build factory for unit tests.   |
| [fixture-harness-page.js](../../tests/browser/fixture-harness-page.js)               | Page harness: DOM utilities and page initialization for integration tests.  |
| [browser-interaction-fixture.js](../../tests/browser/browser-interaction-fixture.js) | Simulates user UI interactions (clicks, form changes) for end-to-end tests. |
