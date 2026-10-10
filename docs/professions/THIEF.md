# Thief

Native shared-engine profession. Entry point `thief.html`. `profession.ts` composes the Core-first tuple from
`catalog.ts`; a runtime contains Core plus at most one of Daredevil, Deadeye, Specter, or Antiquary. Core owns shared
initiative, stealth, weapons, and traits; each specialization owns a complete vertical slice under
`specializations/<name>/`.

## Data

- API identity snapshot: 2026-07-28 (official GW2 API).
- Refresh: `npm run update:profession-data -- --profession Thief`.
- Runtime simulation is network-free. Initiative, skill mechanics, modifiers, and other non-API behavior are checked
  into owner-local `skills/`, `traits/`, and `mechanics/` modules.

Core defines traits in `traits/<line>/index.ts` for Acrobatics, Critical Strikes, Deadly Arts, Shadow Arts, and
Trickery; its index registers them in their original order. Each elite defines and registers its traits in
`traits/index.ts`. Each `defineTrait` owner holds its balance profiles, modifiers, triggers, recharge rules, and build
contributions. Runtime callers import supporting behavior directly from `traits/` helpers. Profile lookups retain
selected-patch tuning and effect-removal behavior; numeric trait IDs are used directly rather than repeated profile
aliases.

The build finalizer retains only equipped signet passives and effective selection. Native `traitBuildAttributes`
contributions join those effects before the shared conversion and finalization phases, including disabled-trait
previews. Runtime resource clocks, stealth and Revealed, Mark/malice, shroud state, artifact slots, and applied windows
remain on their existing shared state.

Ordered mechanic trigger points invoke definition-local handlers: stealth breaks before Unrelenting Strikes and No
Quarter; Core steals notify trait owners before acquisition and initiative; dodge packets resolve before their new
damage windows; mark resets, stolen-skill replacement, and malice rewards retain their existing order. Specter emits its
barrier before Dark Sentry's task and resolves Amplified Siphoning before Improvisation. Antiquary preserves
artifact-grant ordering, Sun Crystal before Mistburn, and applied charge/window lifetimes after selection changes. The
mixed strike sequence lives in `core/mechanics/reactions.ts`. Core steal rewards, poison, critical boons, stealth, and
venoms live inside their owning trait-line folders; `core/mechanics/steal.ts` fires the ordered steal boundary declared
in `core/mechanics/boundaries.ts`. Daredevil dodge transformations and Antiquary artifact transformations retain their
own behavior files.

## Implemented systems

- **Core** — nine terrestrial weapon families with exact main-hand/off-hand matching for every dual-wield and
  empty-offhand slot-3 skill; shared initiative, passive regeneration, explicit weapon-skill costs, weapon-swap
  preservation, Preparedness, and initiative-gain traits; stealth stacking, Revealed, active-weapon stealth attacks, and
  core/Daredevil stolen skills.
- **Daredevil** — physical-skill endurance, the Fist Flurry/Palm Strike window, delayed Pulmonary Impact, staff packets,
  and its damage-window traits.
- **Deadeye** — Mark, malice, Kneel, malicious stealth attacks, and per-malice Backstab scaling.
- **Specter** — Shadow Force pool and Shadow Shroud transitions, Scepter and shroud hit packets, wells, Siphon, and
  initiative-to-Shadow-Force gain.
- **Antiquary** — artifact uses with all artifacts selectable, per-cast Double Edge outcomes, backfire state, and
  persistent Antiquary summons.

Core Steal exposes Detonate Plasma, Throw Magnetic Bomb, and Soul Stone Venom as its standard stolen-skill choice pool.
Double Edge success/backfire is saved per rotation entry; simulation never uses unseeded randomness.

## Modeling boundaries

Single-target, outgoing-damage focused. Incoming attacks, active defense, ally support (Shallow Grave, Consume Shadows,
Traversing Dusk, Panaku's Ambition, Hungering Darkness, etc.), pathing, secondary targets, and competitive (PvP/WvW)
splits are out of model.
