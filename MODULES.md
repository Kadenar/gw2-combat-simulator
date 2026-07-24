# Mesmer Simulator Modules Documentation

Overview of all JavaScript modules in the mesmer-simulator project, organized by functionality.

---

## Application Layer (`js/app/`)

Handles UI rendering, state management, and user interaction orchestration.

### [app.js](js/app/app.js)
Main application controller. Creates MesmerApp class that initializes the page, manages UI rendering for gear/traits/skills/attributes, and orchestrates simulation lifecycle. Entry point for DOMContentLoaded.

### [app-state.js](js/app/app-state.js)
Build persistence and initialization. Provides functions to create default builds, load/save builds from localStorage, and merge saved builds with defaults while maintaining backward compatibility.

### [app-runtime.js](js/app/app-runtime.js)
Simulation orchestration layer. Transforms UI build into simulation config, determines elite specialization, calculates attributes, and triggers simulation runs. Bridges app state and simulation engine.

### [app-io.js](js/app/app-io.js)
File I/O utilities. Provides functions to export builds/rotations as JSON files and import them from user-selected files.

### [app-rotation-ui.js](js/app/app-rotation-ui.js)
Rotation builder UI. Renders the skill rotation timeline, handles drag-and-drop actions, manages concurrent skill placement, and displays skill/effect breakdowns with color-coded conditions and passive effects.

---

## Data Layer (`js/data/`)

Static Guild Wars 2 game data and lookups.

### [mesmer-catalog.js](js/data/mesmer-catalog.js)
Auto-generated GW2 API metadata snapshot. Contains specialization and trait definitions plus skill IDs, names, descriptions, icons, and slots. It intentionally contains no simulator mechanics.

### [mesmer-skill-mechanics.js](js/data/mesmer-skill-mechanics.js)
Simulator-owned base skill mechanics absent from the authoritative override table.

### [mesmer-illusion-data.js](js/data/mesmer-illusion-data.js)
Static weapon-strength, clone, ambush, and phantasm timing tables.

### [mesmer-profession-data.js](js/data/mesmer-profession-data.js)
Static condition, shatter, instrument, trait-damage, and skill-classification tables.

### [gear-data.js](js/data/gear-data.js)
Ascended gear stat tables and equipment lookups. Defines stat values for all gear prefixes (Berserker's, Assassin's, etc.), runes, sigils, food, utilities, infusions, and weapons. Profession-neutral except for Mesmer weapons.

### [traits-data.js](js/data/traits-data.js)
Trait processing. Extracts trait data from specialization catalog, maps traits to tiers/positions, applies stat annotations, and provides active trait lookup by specialization selection.

---

## Core Mechanics (`js/core/`)

Attribute calculations and damage formulas.

### [calc-attributes.js](js/core/calc-attributes.js)
Attribute calculation engine. Computes final attributes (Power, Precision, etc.) from gear, runes, food, traits, utilities, infusions, and sigils. Tracks breakdowns for each stat source and derives secondary attributes (Crit Chance, Crit Damage, Boon/Condition Duration).

### [damage.js](js/core/damage.js)
Damage calculation formulas. Provides strike damage calculation, expected crit multiplier, condition tick damage, and full skill damage breakdowns including per-tick and per-stack effects.

### [weapon-sigils.js](js/core/weapon-sigils.js)
Weapon sigil management. Normalizes sigil selections, provides sigil lookup by weapon set, and enforces sigil constraints (no duplicate sigils per set). Supports duration bonuses from sigils.

---

## Simulation Engine (`js/sim/`)

The simulation is a two-phase pipeline: scheduling creates a versioned timeline, then resolution evaluates it without access to live scheduler state.

### [simulator.js](js/sim/simulator.js)
Public orchestration API. Prepares run configuration, drives scheduler execution, builds the scheduler-to-resolver handoff, and shapes final results.

### Run Setup (`js/sim/run/`)

- [prepare-config.js](js/sim/run/prepare-config.js) — creates an isolated configuration for each run.

### Scheduler (`js/sim/scheduler/`)

- [scheduler.js](js/sim/scheduler/scheduler.js) — thin composition root for scheduler controllers.
- [scheduler-state.js](js/sim/scheduler/scheduler-state.js) — creates mutable state for one scheduling pass.
- [event-factory.js](js/sim/scheduler/event-factory.js) — creates typed scheduled events.
- [expected-procs.js](js/sim/scheduler/expected-procs.js) — accumulates deterministic Bloodsong, Jagged Mind, and Sharper Images procs.
- [cast-controller.js](js/sim/scheduler/cast-controller.js) — validates casts, advances cooldowns, and dispatches skill behavior.
- [cooldown-controller.js](js/sim/scheduler/cooldown-controller.js) — owns cooldown and ammo bookkeeping.
- [continuum-controller.js](js/sim/scheduler/continuum-controller.js) — captures and restores Continuum Split state.
- [resource-controller.js](js/sim/scheduler/resource-controller.js) — owns clone, blade, and note gains.
- [skill-effects.js](js/sim/scheduler/skill-effects.js) — schedules ordinary skill, pulse, phantasm, and trait effects.

### Resolver (`js/sim/resolver/`)

- [resolve-timeline.js](js/sim/resolver/resolve-timeline.js) — resolver composition root and result builder.
- [runtime-state.js](js/sim/resolver/runtime-state.js) — mutable state for one resolution pass.
- [event-loop.js](js/sim/resolver/event-loop.js) — drains the ordered event queue.
- [event-handlers.js](js/sim/resolver/event-handlers.js) — dispatches event types.
- [timeline-index.js](js/sim/resolver/timeline-index.js) — indexes timestamp-based boons, cooldowns, instruments, and weapon sets.
- [combat-stats.js](js/sim/resolver/combat-stats.js) — calculates timestamp-aware attributes and critical strikes.
- [damage-modifiers.js](js/sim/resolver/damage-modifiers.js) — calculates strike, condition, and duration modifiers.
- [resolver-query.js](js/sim/resolver/resolver-query.js) — composes read-only timeline, stat, and modifier queries.
- [hit-resolution.js](js/sim/resolver/hit-resolution.js) — calculates and records strike damage.
- [condition-resolution.js](js/sim/resolver/condition-resolution.js) — resolves condition applications and ticks.

### Shared Simulation (`js/sim/shared/`)

- [event-queue.js](js/sim/shared/event-queue.js) — stable chronological and priority ordering.
- [scheduled-event-stream.js](js/sim/shared/scheduled-event-stream.js) — versioned scheduler-to-resolver boundary.
- [target-state.js](js/sim/shared/target-state.js) — normalizes target-condition assumptions.
- [simulation-time.js](js/sim/shared/simulation-time.js) — shared floating-point timeline tolerance.

### Mechanics (`js/sim/mechanics/`)

- [mesmer-skill-normalization.js](js/sim/mechanics/mesmer-skill-normalization.js) — combines generated metadata, base mechanics, and authoritative overrides into canonical skills.
- [mesmer-skill-overrides.js](js/sim/mechanics/mesmer-skill-overrides.js) — hand-authored skills, measured timings, and catalog corrections.
- [illusion-actions.js](js/sim/mechanics/illusion-actions.js) — clone attack scheduling.
- [profession-actions.js](js/sim/mechanics/profession-actions.js) — shatters, instruments, and specialization resources.
- [mirage-actions.js](js/sim/mechanics/mirage-actions.js) — Mirage Cloak and ambush behavior.
- [trait-rules.js](js/sim/mechanics/trait-rules.js) — resolver-time trait reactions.
- [relic-rules.js](js/sim/mechanics/relic-rules.js) — relic triggers and modifiers.

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

```
User Input (UI)
    ↓
[app.js] - MesmerApp controller
    ↓
[app-state.js] - Build persistence
    ↓
[app-runtime.js] - Build → Simulation config transformation
    ↓
[simulator.js] - Public orchestrator
    ├→ [scheduler.js] - Action scheduling phase
    │   ├→ [scheduler-state.js] - State tracking
    │   ├→ [event-factory.js] - Event creation
    │   ├→ [expected-procs.js] - Expected proc tracking
    │   └→ focused mechanic controllers
    │
    ├→ [calc-attributes.js] - Attribute calculation
    │   ├→ [gear-data.js] - Gear stat lookup
    │   ├→ [traits-data.js] - Active trait extraction
    │   └→ [weapon-sigils.js] - Sigil stat aggregation
    │
    └→ [resolve-timeline.js] - Damage resolution phase
        ├→ [runtime-state.js] - Resolution state
        ├→ [event-loop.js] - Event dispatch
        ├→ [resolver-query.js] - Timeline/stat/modifier queries
        ├→ [hit-resolution.js] - Strike damage calc
        ├→ [condition-resolution.js] - Condition damage calc
        ├→ [trait-rules.js] - Trait modifiers
        └→ [relic-rules.js] - Relic passive effects

Results
    ↓
[app.js] - Render UI with breakdown
    ├→ [app-rotation-ui.js] - Timeline/rotation display
    └→ Display damage totals, breakdowns, active cooldowns
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
| `js/app/` | UI, state management, orchestration |
| `js/data/` | Static GW2 data, catalogs |
| `js/core/` | Attribute calc, damage formulas, gear |
| `js/sim/` | Rotation simulation engine |
| `js/sim/scheduler/` | Action scheduling, cooldown tracking |
| `js/sim/resolver/` | Damage calculation, effect resolution |
| `js/sim/shared/` | Event queue, serialization |
| `js/sim/mechanics/` | Profession rules, skill definitions |
| `tests/browser/` | Browser interaction fixtures |
| `tests/helpers/` | Shared testing utilities |
