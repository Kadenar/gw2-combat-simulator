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
Profession-neutral modifier comparison orchestration. Mesmer
build-to-simulation mapping and modifier candidate rules live in
`js/professions/mesmer/app/app-runtime.js`.

### [app-io.js](js/app/app-io.js)
File I/O utilities. Provides functions to export builds/rotations as JSON files and import them from user-selected files.

### [app-ui.js](js/app/app-ui.js)
Shared application metadata and HTML option rendering for gear, attributes, and
target-condition controls.

---

## Data Layer (`js/data/`)

Static Guild Wars 2 game data and lookups.

### [catalog.js](js/data/catalog.js)
Compatibility export for the Mesmer-owned catalog. The source snapshot lives in
`js/professions/mesmer/data/mesmer-catalog.js`.

### [skill-mechanics.js](js/data/skill-mechanics.js)
Compatibility export for Mesmer-owned base skill mechanics.

### [illusion-data.js](js/data/illusion-data.js)
Compatibility export for Mesmer-owned illusion data.

### [profession-data.js](js/data/profession-data.js)
Compatibility export for Mesmer-owned profession data.

### [gear-data.js](js/data/gear-data.js)
Ascended gear stat tables and equipment lookups. Defines stat values for all gear prefixes (Berserker's, Assassin's, etc.), runes, sigils, food, utilities, infusions, and weapons. Profession-neutral except for Mesmer weapons.

### [traits-data.js](js/data/traits-data.js)
Trait processing. Extracts trait data from specialization catalog, maps traits to tiers/positions, applies stat annotations, and provides active trait lookup by specialization selection.

---

## Core Mechanics (`js/core/`)

Attribute calculations and damage formulas.

### [calc-attributes.js](js/core/calc-attributes.js)
Profession-neutral compatibility entry point for common attribute assembly.
Profession traits and skill bonuses are applied by each profession's own
calculator under `js/professions/<profession>/core/calc-attributes.js`.

### [damage.js](js/core/damage.js)
Damage calculation formulas. Provides strike damage calculation, expected crit multiplier, condition tick damage, and full skill damage breakdowns including per-tick and per-stack effects.

### [weapon-sigils.js](js/core/weapon-sigils.js)
Weapon sigil management. Normalizes sigil selections, provides sigil lookup by weapon set, and enforces sigil constraints (no duplicate sigils per set). Supports duration bonuses from sigils.

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
- [scheduler-state.js](js/platform/engine/scheduler-state.js) — profession-neutral mutable state.
- [cooldown-controller.js](js/platform/engine/cooldown-controller.js) — shared cooldown and ammo state machine.
- [event-factory.js](js/platform/gw2/scheduler/event-factory.js) — canonical GW2 scheduler events.
- [Mesmer scheduler](js/professions/mesmer/scheduler/scheduler.js) — Mesmer mechanic controllers composed over the shared state, cooldown, and event primitives.

### Resolver

- [resolve-timeline.js](js/platform/gw2/resolver/resolve-timeline.js) — shared resolver composition and result builder.
- [runtime-state.js](js/platform/gw2/resolver/runtime-state.js) — common damage, condition, relic, sigil, and reporting state.
- [event-loop.js](js/platform/gw2/resolver/event-loop.js) — ordered dispatch, combat bounds, and target death.
- [event-handlers.js](js/platform/gw2/resolver/event-handlers.js) — common damage, condition, control, sigil, relic, and weapon-swap behavior.
- [hit-resolution.js](js/platform/gw2/resolver/hit-resolution.js) — shared strike resolution with injected profession modifiers.
- [condition-resolution.js](js/platform/gw2/resolver/condition-resolution.js) — shared condition applications and ticks.
- [Mesmer reactions](js/professions/mesmer/resolver/event-handlers.js) — Ineptitude, critical traits, Bloodsong, and Mesmer custom timeline events.
- [Mesmer resolver profile](js/professions/mesmer/resolver/resolver-profile.js) — binds Mesmer queries and reactions to the shared resolver.

### Shared Platform Simulation

- [event-queue.js](js/platform/engine/event-queue.js) — stable chronological and priority ordering.
- [compat-scheduled-event-stream.js](js/platform/engine/compat-scheduled-event-stream.js) — legacy scheduler-to-resolver boundary.
- [clock.js](js/platform/engine/clock.js) — shared floating-point timeline tolerance.
- [target-state.js](js/platform/gw2/target-state.js) — normalizes target-condition assumptions.

### Mesmer Mechanics (`js/professions/mesmer/mechanics/`)

- [mesmer-skill-normalization.js](js/professions/mesmer/mechanics/mesmer-skill-normalization.js) — canonical Mesmer skill assembly.
- [mesmer-skill-overrides.js](js/professions/mesmer/mechanics/mesmer-skill-overrides.js) — hand-authored mechanics and catalog corrections.
- [illusion-actions.js](js/professions/mesmer/mechanics/illusion-actions.js) — clone attack scheduling.
- [profession-actions.js](js/professions/mesmer/mechanics/profession-actions.js) — shatters, instruments, and specialization resources.
- [mirage-actions.js](js/professions/mesmer/mechanics/mirage-actions.js) — Mirage Cloak and ambush behavior.
- [trait-rules.js](js/professions/mesmer/mechanics/trait-rules.js) — Mesmer resolver reactions.

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
[professions/mesmer/app/app-runtime.js] - Build → Simulation config transformation
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
    ├→ [professions/mesmer/app/app-rotation-ui.js] - Timeline/rotation display
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
| `js/platform/engine/` | Shared scheduling, event queue, and simulation primitives |
| `js/platform/gw2/` | Shared GW2 formulas, scheduler events, resolver, gear, relics, and target state |
| `js/professions/mesmer/mechanics/` | Mesmer rules and skill definitions |
| `tests/browser/` | Browser interaction fixtures |
| `tests/helpers/` | Shared testing utilities |
