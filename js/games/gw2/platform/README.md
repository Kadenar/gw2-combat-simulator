# GW2 Platform Organization

The GW2 platform is organized by ownership. Put a module in the narrowest domain that owns its concepts and invariants.

| Directory                | Owns                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `builds/`                | Build normalization, attributes, target conditions, and templates                       |
| `combat/`                | Damage formulas, modifiers, queries, and combat state                                   |
| `combos/`                | Combo definitions, catalogs, and events                                                 |
| `engine/`                | Runtime contracts, scheduler execution, cooldowns, effects, and profession composition  |
| `equipment/`             | Gear, consumables, relics, sigils, and weapons                                          |
| `profession-definition/` | Stable profession authoring APIs, catalog assembly, metadata, and mechanic declarations |
| `resolver/`              | Event resolution and reaction processing                                                |
| `results/`               | Simulation result queries                                                               |
| `scheduler/`             | GW2 event preparation, combat observation, and combo/equipment proc materialization     |
| `simulation/`            | Simulation configuration, orchestration, and public result types                        |
| `skills/`                | Shared skill timing and recharge behavior                                               |

Optional patch-preview authoring, validation, and overlays belong in `../integrations/patches/`. See
[Simulator modules](../../../../docs/architecture/MODULES.md#shared-guild-wars-2-platform) for the wider ownership map.

## Placement Rules

- Keep declaration files beside the domain that owns the declared contract.
- Keep runtime execution in `engine/execution/`, GW2 scheduler-only materialization in `scheduler/`, and resolver-only
  reactions in `resolver/`.
- Do not import `resolver/` from `scheduler/`, or `scheduler/` from `resolver/`. Coordinate them through `simulation/`.
- Import the owning module directly. Domain indexes are deliberate public APIs, not compatibility paths.
- Keep the platform root limited to the public simulation entry point.
