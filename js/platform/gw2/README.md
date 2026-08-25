# GW2 Platform Organization

The GW2 platform is organized by ownership. Put a module in the narrowest domain that owns its concepts and invariants.

| Directory | Owns |
| --- | --- |
| `authoring/` | Profession authoring APIs, metadata, mechanics, and patches |
| `builds/` | Build normalization, attributes, target conditions, and templates |
| `combat/` | Damage formulas, modifiers, queries, and combat state |
| `combos/` | Combo definitions, catalogs, and events |
| `equipment/` | Gear, consumables, relics, sigils, and weapons |
| `resolver/` | Event resolution and reaction processing |
| `results/` | Simulation result queries |
| `scheduler/` | Timeline construction and event scheduling |
| `simulation/` | Simulation configuration, orchestration, and public result types |
| `skills/` | Shared skill timing and recharge behavior |

## Placement Rules

- Keep declaration files beside the domain that owns the declared contract.
- Keep scheduler-only materialization in `scheduler/` and resolver-only reactions in `resolver/`.
- Do not import `resolver/` from `scheduler/`, or `scheduler/` from `resolver/`. Coordinate them through `simulation/`.
- Import the owning module directly. Domain indexes are deliberate public APIs, not compatibility paths.
- Keep the platform root limited to the public simulation entry point.
