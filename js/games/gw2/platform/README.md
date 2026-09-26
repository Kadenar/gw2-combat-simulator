# GW2 Platform Organization

The GW2 platform is organized by ownership. Put a module in the narrowest domain that owns its concepts and invariants.

| Directory                  | Owns                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| `builds/`                  | Build normalization, attributes, target conditions, and templates                                 |
| `combat/`                  | Damage formulas, modifiers, queries, and combat state                                             |
| `combos/`                  | Combo definitions, catalogs, and events                                                           |
| `engine/`                  | Runtime contracts, canonical events/skills, pure effects, and profession composition              |
| `execution/`               | Rotation commands, cast reservations, cooldowns, ammo, and interruption arithmetic                |
| `equipment/`               | Gear, consumables, relics, sigils, and weapons                                                    |
| `profession-definition/`   | Stable profession authoring APIs, catalog assembly, metadata, and mechanic declarations           |
| `profession-presentation/` | Application UI composition, validation, defaults, and display contracts                           |
| `resolver/`                | Event resolution and reaction processing                                                          |
| `results/`                 | Combat result construction, planning-state projection, committed-effect queries, and rotation APM |
| `simulation/`              | One live simulation runtime, configuration, and public result types                               |
| `skills/`                  | GW2 skill timing, recharge, transition delays, aliases, and autoattack-chain control              |

Profession implementations live in `../professions/<profession>/`; their folder layout is described in
[Simulator modules](../../../../docs/architecture/MODULES.md#profession-modules).

Optional patch-preview authoring, validation, and overlays belong in `../integrations/patches/`. See
[Simulator modules](../../../../docs/architecture/MODULES.md#shared-guild-wars-2-platform) for the wider ownership map.

Generic arithmetic is game-neutral and lives in `#kernel/core/numeric.js`; coercion of unvalidated build input belongs
to `builds/codec.ts`. Seeded critical-proc eligibility, secondary rolls, and ICD claims belong to
`combat/critical-procs.ts`; whole-millisecond duration rounding and absolute effect expiry remain separate operations in
`skills/timing.ts`. Condition coefficients live in `combat/formulas.ts`. Boon queries share stack/pool calculations in
`combat/boons.ts` using executed history at the current logical time.

Catalog indexing and balance-profile lookups belong in `engine/skills/`; GW2 autoattack-chain state transitions belong
in `skills/autoattack-chain-controller.ts`. Shared event-to-skill lookup lives in `combat/query/event-skill.ts`, and
damage-diagnostic event fields are declared alongside the event schema in `engine/events/events.ts`.

Weapon eligibility is the profession's `weaponSkillMatchesSet` runtime callback. Simulation and application adapters
consume that same policy; it is not a presentation hook. Equipment picker icons belong in
`../app/shared/equipment-icons.ts`.

## Placement Rules

- Keep declaration files beside the domain that owns the declared contract.
- Keep runtime orchestration in `simulation/`, reusable cast/cooldown services in `execution/`, and hit/condition
  reactions in `resolver/`.
- Compose execution and resolution services through `simulation/runtime.ts`.
- Import the owning module directly. Domain indexes are deliberate public APIs, not compatibility paths.
- Keep the platform root limited to the public simulation entry point.

`simulation/runtime.ts` owns one cursor, heap, profession state, target state, resource controller, and RNG. Commands,
internal tasks, hits, procs, and condition wakes settle on that clock. Internal work has registered handlers and
detached data payloads; lifetime generations cancel obsolete work without erasing committed projectiles.

`profession-definition/profession.ts` remains the public native compiler. Its internal runtime stages stay in
`engine/profession/`. Compiled live runtimes expose cast hooks, tasks, and combat reactions on the same state. Build
callbacks live on the family application contract, normalized by `builds/profession-contract.ts`; presentation
initializes lazily through the family's `ui` adapter. Headless runtime compilation and simulation do not initialize
presentation factories.

`results/build-result.ts` projects executed combat facts. `results/end-state.ts` projects live planning state at the
requested observation boundary, including command continuation after target death. Combat state is detached at the
earlier combat boundary. Result queries index committed effects; neither projection is a checkpoint.
