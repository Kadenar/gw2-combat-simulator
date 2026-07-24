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
Mesmer skill catalog and specialization definitions. Auto-generated snapshot from official GW2 API. Contains all specializations (core + elite), trait definitions, and skill metadata.

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

Core rotation simulation and damage calculation.

### [sim-engine.js](js/sim/sim-engine.js)
Main simulation orchestrator. Provides `simulateRotation()` (repeatable benchmark) and `simulateSequence()` (single-pass builder display) functions. Parses rotations, manages scheduler state, resolves events, and returns detailed damage breakdowns with cooldown/ammo state.

### Scheduler (`js/sim/scheduler/`)

Tracks action scheduling and cooldown state during rotation execution.

#### [sim-scheduler.js](js/sim/scheduler/sim-scheduler.js)
Scheduler factory. Creates scheduler instance from config/traits/horizon, coordinates sub-components (state, intents, events), and exposes `cast(skill)` and `advanceTo(time)` APIs.

#### [sim-scheduler-state.js](js/sim/scheduler/sim-scheduler-state.js)
Scheduler state machine. Manages active weapon set, cooldowns, ammo, clones, Continuum Split state, and blade/note resources. Tracks pending resource gains and autoattack chain progression.

#### [sim-scheduler-events.js](js/sim/scheduler/sim-scheduler-events.js)
Event factory and sequencing. Creates action/cooldown/resource/condition events with timing and priority. Handles activation time calculation, skill effects sequencing, and ammo recharge logic.

#### [sim-scheduler-intents.js](js/sim/scheduler/sim-scheduler-intents.js)
Intent-to-action parsing. Translates skill casts and user intents into scheduled events. Manages weapon swap sequencing, autoattack chains, and interrupt behavior.

### Resolver (`js/sim/resolver/`)

Post-scheduling damage and effect resolution.

#### [sim-resolver.js](js/sim/resolver/sim-resolver.js)
Event resolution orchestrator. Creates runtime context, records passive relic timelines, drains queued events through resolver, and produces final damage/condition breakdown.

#### [sim-runtime-context.js](js/sim/resolver/sim-runtime-context.js)
Resolver execution context. Manages damage/condition/trait proc tracking, builds damage breakdown by source, coordinates event dispatch to specialized handlers.

#### [sim-resolver-events.js](js/sim/resolver/sim-resolver-events.js)
Event handler dispatch. Routes events to specialized resolvers (hit resolution, condition resolution, event handlers) and manages event queue draining.

#### [sim-hit-resolution.js](js/sim/resolver/sim-hit-resolution.js)
Hit damage calculation. Resolves action events to strike/condition damage using calculated attributes, applies critical strike multipliers, and tracks per-hit breakdowns.

#### [sim-condition-resolution.js](js/sim/resolver/sim-condition-resolution.js)
Condition application and damage. Resolves condition events, applies duration bonuses, calculates tick damage over duration, and handles condition-specific mechanics (e.g., Torment movement penalty).

#### [sim-query-context.js](js/sim/resolver/sim-query-context.js)
Pre-resolver query context. Builds queryable maps of events by type/skill for use during resolution. Provides utilities for condition duration multipliers and sigil aggregation.

#### [sim-event-handlers.js](js/sim/resolver/sim-event-handlers.js)
Specialized event handlers. Routes non-damage events (trait procs, boons, effects) through appropriate resolvers.

### Shared Simulation (`js/sim/shared/`)

Common event handling and serialization.

#### [sim-event-queue.js](js/sim/shared/sim-event-queue.js)
Event queue management. Maintains chronological + priority-based + insertion-order event ordering. Provides enqueue, sort, and dequeue operations for the event timeline.

#### [sim-scheduled-event-stream.js](js/sim/shared/sim-scheduled-event-stream.js)
Event stream serialization. Wraps scheduler-produced events into a versioned, serializable stream format for passing to resolver. Includes validation and schema enforcement.

#### [sim-target-state.js](js/sim/shared/sim-target-state.js)
Normalizes permanent target-condition assumptions and exposes their active stack
counts to damage, trait, and relic resolution.

### Mechanics (`js/sim/mechanics/`)

Profession-specific rules and skill definitions.

#### [mesmer-illusion-data.js](js/sim/mechanics/mesmer-illusion-data.js)
Illusion/clone attack tables. Defines weapon strength values, clone auto-attack patterns by weapon, phantasm attack timings, and ambush attack schedules.

#### [mesmer-profession-data.js](js/sim/mechanics/mesmer-profession-data.js)
Profession mechanics data. Condition formulas (base + scaling), shatter definitions, instrument definitions, control/blind/ambush skill lists, and Peitha relic skill tags.

#### [mesmer-skill-normalization.js](js/sim/mechanics/mesmer-skill-normalization.js)
Skill definition normalization. Transforms raw catalog skills into usable form, adds pseudo-skills (Weapon Swap, Wait, Combat Start), handles skill activation/cooldown adjustments per boons, and auto-attack chain definitions.

#### [sim-profession-actions.js](js/sim/mechanics/sim-profession-actions.js)
Profession mechanic controller. Implements shatters, blade generation, note management, and clone attacks. Handles resource consumption, trait-specific shatter behavior (Chrono, Virtuoso, Troubadour), and melee attacking.

#### [sim-illusion-actions.js](js/sim/mechanics/sim-illusion-actions.js)
Clone/phantasm attack scheduling. Schedules clone auto-attack loops, phantasm attacks, and applies ambush effects. Manages clone death tracking and attack output generation.

#### [sim-resolver-trait-rules.js](js/sim/mechanics/sim-resolver-trait-rules.js)
Trait effect resolution. Applies trait-specific damage/condition modifiers during hit resolution (e.g., Empowered Illusions, Malicious Sorcery).

#### [sim-relic-rules.js](js/sim/mechanics/sim-relic-rules.js)
Relic passive effect timeline. Generates passive events for relics (Aristocracy, Peitha, etc.) and applies ongoing effects to damage.

---

## Fixtures (`js/fixtures/`)

Testing utilities and harnesses.

### [fixture-harness-core.js](js/fixtures/fixture-harness-core.js)
Core test harness. Provides default simulation config and build factory for unit tests.

### [fixture-harness-page.js](js/fixtures/fixture-harness-page.js)
Page fixture harness. DOM utilities and page initialization helpers for integration tests.

### [browser-interaction-fixture.js](js/fixtures/browser-interaction-fixture.js)
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
[sim-engine.js] - Main orchestrator
    ├→ [sim-scheduler.js] - Action scheduling phase
    │   ├→ [sim-scheduler-state.js] - State tracking
    │   ├→ [sim-scheduler-events.js] - Event creation
    │   └→ [sim-scheduler-intents.js] - Skill intent parsing
    │
    ├→ [calc-attributes.js] - Attribute calculation
    │   ├→ [gear-data.js] - Gear stat lookup
    │   ├→ [traits-data.js] - Active trait extraction
    │   └→ [weapon-sigils.js] - Sigil stat aggregation
    │
    └→ [sim-resolver.js] - Damage resolution phase
        ├→ [sim-runtime-context.js] - Resolution context
        ├→ [sim-resolver-events.js] - Event dispatch
        ├→ [sim-hit-resolution.js] - Strike damage calc
        ├→ [sim-condition-resolution.js] - Condition damage calc
        ├→ [sim-resolver-trait-rules.js] - Trait modifiers
        ├→ [sim-relic-rules.js] - Relic passive effects
        └→ [sim-profession-actions.js] - Shatter/resource effects

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
| `js/fixtures/` | Testing utilities |
