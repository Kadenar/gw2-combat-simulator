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
| `results/`               | Simulation result queries and rotation APM reporting                                    |
| `scheduler/`             | GW2 event preparation, combat observation, and combo/equipment proc materialization     |
| `simulation/`            | Simulation configuration, orchestration, and public result types                        |
| `skills/`                | GW2 skill timing, recharge, transition delays, aliases, and autoattack-chain control    |

Profession implementations live in `../professions/<profession>/`; their folder layout is described in
[Simulator modules](../../../../docs/architecture/MODULES.md#profession-modules).

Optional patch-preview authoring, validation, and overlays belong in `../integrations/patches/`. See
[Simulator modules](../../../../docs/architecture/MODULES.md#shared-guild-wars-2-platform) for the wider ownership map.

Generic arithmetic is game-neutral and lives in `#kernel/core/numeric.js`; coercion of unvalidated build input belongs
to `builds/normalization.ts`. Critical progress belongs to `combat/critical-procs.ts`; whole-millisecond duration
rounding and absolute effect expiry remain separate operations in `skills/timing.ts`. Condition coefficients live in
`combat/formulas.ts`. Boon queries share stack/pool calculations in `combat/boons.ts` while selecting their own
phase-visible histories.

Catalog indexing and balance-profile lookups belong in `engine/skills/`; GW2 autoattack-chain state transitions belong
in `skills/autoattack-chain-controller.ts`. Shared event-to-skill lookup lives in `combat/query/event-skill.ts`, and
damage-diagnostic event fields are declared alongside the event schema in `engine/events/events.ts`.

Weapon eligibility is the profession's `weaponSkillMatchesSet` runtime callback. Simulation and application adapters
consume that same policy; it is not a presentation hook. Equipment picker icons belong in
`../app/shared/equipment-icons.ts`.

## Placement Rules

- Keep declaration files beside the domain that owns the declared contract.
- Keep runtime execution in `engine/execution/`, GW2 scheduler-only materialization in `scheduler/`, and resolver-only
  reactions in `resolver/`.
- Do not import `resolver/` from `scheduler/`, or `scheduler/` from `resolver/`. Coordinate them through `simulation/`.
- Import the owning module directly. Domain indexes are deliberate public APIs, not compatibility paths.
- Keep the platform root limited to the public simulation entry point.
