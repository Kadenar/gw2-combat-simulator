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

### [app.js](js/app/app.js)
Main application shell. Exports the `ProfessionApp` class, which is constructed
with the active profession app adapter, manages UI rendering for
gear/traits/skills/attributes, and orchestrates the simulation lifecycle. Entry
point for DOMContentLoaded resolves the adapter for the current page.

### [create-app-adapter.js](js/app/create-app-adapter.js) / [create-profession-runtime.js](js/app/create-profession-runtime.js)
Shared factories that build a profession's browser app adapter and its
simulation runtime from the profession contract.

### Profession `definition.js` and `app/app-definition.js`

Each native profession has two deliberately separate composition boundaries:

- `definition.js` exports the engine-facing profession contract: catalog,
  build migration and validation, resources, mechanics, scheduler/resolver
  hooks, and engine attribute rules. Engine-only consumers use this module.
- `app/app-definition.js` composes that contract for the shared browser shell.
  It constructs the build attribute calculator and application runtime, then
  supplies persistence metadata, import/export filenames, selector behavior,
  build-to-simulation mapping, and the application adapter.

Keeping browser composition out of `definition.js` lets simulations and other
engine consumers load a profession without pulling in application rendering,
storage, and modifier-contribution dependencies. Elementalist remains a
standalone legacy application and does not use this native composition pattern.

### [profession-registry.js](js/app/profession-registry.js)
Single lazy manifest for every profession exposed by the application. Each
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

### [profession-selector.js](js/app/profession-selector.js)
Registry-driven landing-page and header navigation. `bindProfessionSelector()`
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

### [rotation-ui.js](js/app/rotation-ui.js)
Shared rotation palette, timeline, and results renderer driven by profession
palette/resource view models and canonical result state.

### [app-state.js](js/app/app-state.js)
Build persistence and initialization. Creates default builds, loads/saves builds
from localStorage, and merges saved builds with defaults through the active
adapter while maintaining backward compatibility. Local-storage loading is
forgiving, but explicit build replacement/import is strict so wrong-profession
and future-version errors reach the user.

### [modifier-contributions.js](js/app/modifier-contributions.js)
Profession-neutral modifier contribution calculations. Per-profession
build-to-simulation mapping and modifier candidate rules live under each
profession's `app/` directory (e.g.
`js/professions/mesmer/app/app-definition.js`).

### [modifier-contributions-worker.js](js/app/modifier-contributions-worker.js)
Background worker that runs the per-modifier contribution comparison off the
main thread.

### [gw2-simulation-config.js](js/app/gw2-simulation-config.js)
Shared default GW2 simulation config used by applications and fixtures.

### [app-io.js](js/app/app-io.js)
File I/O utilities. Exports builds/rotations as JSON files and imports them from
user-selected files.

### [app-ui.js](js/app/app-ui.js)
Shared application metadata and HTML option rendering for gear, attributes, and
target-condition controls.

---

## Data ownership

Static Guild Wars 2 game data and lookups live with their owning layer.

- Generated profession API metadata lives in each profession's
  `data/<profession>-api-metadata.js`; authoritative skill formulas live in
  `mechanics/skill-mechanics.js`.
- [Shared gear data](js/platform/gw2/gear-data.js) contains equipment,
  consumable, infusion, weapon, sigil, rune, and relic lookups.
- Elementalist-owned data and CSV loading live under
  `js/professions/elementalist/data/`.

---

## Shared GW2 Mechanics (`js/platform/gw2/`)

Attribute calculations and damage formulas.

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
- [skill-factories.js](js/platform/engine/skill-factories.js) — shared
  canonical skill-mechanic constructors.
- [autoattack-chains.js](js/platform/engine/autoattack-chains.js) — shared
  ID-based autoattack-chain discovery and indexing used by canonical catalogs.
- [scheduler-state.js](js/platform/engine/scheduler-state.js) — profession-neutral mutable state.
- [cooldown-controller.js](js/platform/engine/cooldown-controller.js) — shared cooldown and ammo state machine.
- [GW2 scheduler policy](js/platform/gw2/scheduler/policy.js) — Quickness,
  Alacrity, and starting-weapon-set policy injected into the neutral scheduler.
- [event-factory.js](js/platform/gw2/scheduler/event-factory.js) — canonical GW2 scheduler events.
- [Mesmer contract](js/professions/mesmer/mechanics/contract.js) — Mesmer
  availability, lifecycle hooks, task handlers, and end-state projection.

### Resolver

- [resolve-timeline.js](js/platform/gw2/resolver/resolve-timeline.js) — shared resolver composition and result builder.
- [runtime-state.js](js/platform/gw2/resolver/runtime-state.js) — common damage, condition, relic, sigil, and reporting state.
- [event-loop.js](js/platform/gw2/resolver/event-loop.js) — ordered dispatch, combat bounds, and target death.
- [event-handlers.js](js/platform/gw2/resolver/event-handlers.js) — common damage, condition, control, sigil, relic, and weapon-swap behavior.
- [hit-resolution.js](js/platform/gw2/resolver/hit-resolution.js) — shared strike resolution with injected profession modifiers.
- [condition-resolution.js](js/platform/gw2/resolver/condition-resolution.js) — shared condition applications and ticks.
- [Mesmer reactions](js/professions/mesmer/resolver/event-handlers.js) — Ineptitude, critical traits, Bloodsong, and Mesmer custom timeline events.

### Shared Platform Simulation

- [event-queue.js](js/platform/engine/event-queue.js) — stable chronological and priority ordering.
- [scheduled-event-stream.js](js/platform/engine/scheduled-event-stream.js) —
  canonical scheduler-to-resolver boundary.
- [clock.js](js/platform/engine/clock.js) — shared floating-point timeline tolerance.
- [target-state.js](js/platform/gw2/target-state.js) — normalizes target-condition assumptions.

### Declarative Profession Mechanics

Every native profession uses the same files for shared concepts:

- `attribute-rules.js` — profession predicates, declarative scalar modifier
  rules, and exceptional ordered attribute transforms.
- `build-attributes.js` — profession-owned trait delta and conversion
  calculation before shared finalization.
- `data/<profession>-api-metadata.js` — generated identity and presentation
  metadata only.
- `data/trait-coverage.js` — one validated, non-pending disposition per catalog
  trait, with structured behavioral test evidence for implemented effects.
- `mechanics/skill-mechanics.js` — shared-schema declarative skill mechanics.
- `mechanics/handler-mechanics.js` — optional profession-specific triggered
  effect and state-machine formulas.
- `catalog.js` — canonical autoattack-chain derivation plus any profession
  additions or exclusions.
- `mechanics/handlers.js` — explicit augment/replace runtime strategies.

Each native `definition.js` is composed through
`platform/engine/profession.js`. That module owns the complete UI callback
surface, canonical event-log descriptors, structured palette availability,
public resource views, optional immutable scheduler-config refinement, and
callback type validation. Scheduler snapshots remain profession-internal;
`resources.projectEndState` publishes an explicit allowlisted state object.

`platform/gw2/attribute-provenance.js` defines the shared marker that tells
runtime hooks whether static profession rules were already applied by browser
build calculation and which weapon set supplied those attributes.

### Mesmer-Specific Mechanics

- [mesmer-supplemental-skills.js](js/professions/mesmer/data/mesmer-supplemental-skills.js) — positive-ID ambush and flip identity omitted from the API snapshot.
- [trait-coverage.js](js/professions/mesmer/data/trait-coverage.js) — validated disposition for every catalog trait.
- [contract.js](js/professions/mesmer/mechanics/contract.js) — standard
  profession hooks, scheduler-local runtime construction, typed tasks, and
  chain-preservation policy.
- [handler-mechanics.js](js/professions/mesmer/mechanics/handler-mechanics.js) — stable-ID handler classification and flip relationships.
- [handlers.js](js/professions/mesmer/mechanics/specific/handlers.js) — registered augment/replace cast strategies.
- [availability.js](js/professions/mesmer/mechanics/availability.js) — pure scheduler and palette availability predicates.
- [illusions.js](js/professions/mesmer/mechanics/specific/illusions.js) — task-driven
  clone attack scheduling.
- [resources.js](js/professions/mesmer/mechanics/specific/resources.js) — clone, blade,
  and note gains.
- [continuum.js](js/professions/mesmer/mechanics/specific/continuum.js) — Continuum
  checkpoint and restoration behavior.
- [expected-procs.js](js/professions/mesmer/mechanics/specific/expected-procs.js) —
  deterministic scheduling-relevant proc progress.
- [profession-actions.js](js/professions/mesmer/mechanics/specific/profession-actions.js) — shatters, phantasms, instruments, and specialization resources.
- [skill-effects.js](js/professions/mesmer/mechanics/specific/skill-effects.js) — exceptional cast profiles selected by registered handler metadata.
- [mirage.js](js/professions/mesmer/mechanics/specific/mirage.js) — Mirage Cloak and ambush behavior.
- [trait-rules.js](js/professions/mesmer/mechanics/specific/trait-rules.js) — Mesmer resolver reactions.

Ordinary effects remain in the canonical `effects` array and use shared
scheduling. Replacing handlers have empty canonical effects and retain their
profession-owned profile as `mesmerEffects`. Completion and future state
changes remain chronological through lifecycle hooks and `mesmer.*` tasks.

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
| `Builds/`, `Rotations/`, `csv input/` | Elementalist presets, rotation examples, and skill/hit CSVs |
| `tests/browser/` | Browser interaction fixtures |
| `tests/helpers/` | Shared testing utilities |
