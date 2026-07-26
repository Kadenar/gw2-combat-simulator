# Simulator Modules Documentation

Overview of the JavaScript modules in the combat simulator, organized by
functionality. The shared shell is profession-neutral; Mesmer, Elementalist,
Guardian, and Necromancer each supply their own catalog, mechanics, and app
adapter.

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

### [composition.js](js/app/composition.js)
Registers the available profession app adapters and exposes the active/default
adapter plus async adapter lookup by profession id.

### [create-app-adapter.js](js/app/create-app-adapter.js) / [create-profession-runtime.js](js/app/create-profession-runtime.js)
Shared factories that build a profession's browser app adapter and its
simulation runtime from the profession contract.

### [profession-selector.js](js/app/profession-selector.js)
Landing-page and header profession picker that routes between the four
applications while preserving one visual system and independent persisted
builds.

### [rotation-ui.js](js/app/rotation-ui.js)
Shared rotation palette, timeline, and results renderer driven by profession
palette/resource view models and canonical result state.

### [app-state.js](js/app/app-state.js)
Build persistence and initialization. Creates default builds, loads/saves builds
from localStorage, and merges saved builds with defaults through the active
adapter while maintaining backward compatibility.

### [app-runtime.js](js/app/app-runtime.js)
Profession-neutral modifier comparison orchestration. Per-profession
build-to-simulation mapping and modifier candidate rules live under each
profession's `app/` directory (e.g. `js/professions/mesmer/app/app-runtime.js`).

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

### [attributes.js](js/platform/gw2/attributes.js)
Profession-neutral common attribute assembly.
Profession traits and skill bonuses are applied by each profession's own
calculator under `js/professions/<profession>/core/calc-attributes.js`.

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
  ID-based autoattack-chain discovery and indexing.
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

Mesmer, Guardian, and Necromancer use the same files for shared concepts:

- `data/<profession>-api-metadata.js` — generated identity and presentation
  metadata only.
- `mechanics/skill-mechanics.js` — the sole authoritative skill mechanics map.
- `mechanics/autoattack-chains.js` — autoattack-chain declarations.
- `mechanics/handlers.js` — imperative runtime handlers, when needed.

### Mesmer-Specific Mechanics

- [autoattack-chains.js](js/professions/mesmer/mechanics/autoattack-chains.js) — shared chain derivation plus Mesmer-specific chain-preservation policy.
- [contract.js](js/professions/mesmer/mechanics/contract.js) — standard
  profession contract composition and task registration.
- [illusions.js](js/professions/mesmer/mechanics/illusions.js) — task-driven
  clone attack scheduling.
- [resources.js](js/professions/mesmer/mechanics/resources.js) — clone, blade,
  and note gains.
- [continuum.js](js/professions/mesmer/mechanics/continuum.js) — Continuum
  checkpoint and restoration behavior.
- [expected-procs.js](js/professions/mesmer/mechanics/expected-procs.js) —
  deterministic scheduling-relevant proc progress.
- [profession-actions.js](js/professions/mesmer/mechanics/profession-actions.js) — shatters, phantasms, instruments, and specialization resources.
- [skill-effects.js](js/professions/mesmer/mechanics/skill-effects.js) — Mesmer-specific declarative effect and handler helpers used by the mechanics map.
- [mirage.js](js/professions/mesmer/mechanics/mirage.js) — Mirage Cloak and ambush behavior.
- [trait-rules.js](js/professions/mesmer/mechanics/trait-rules.js) — Mesmer resolver reactions.

Mesmer expresses its complex cast behavior through these feature modules rather
than a single `handlers.js`; the shared `handlers.js` role is used by Guardian
and Necromancer where an imperative handler file is needed.

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
