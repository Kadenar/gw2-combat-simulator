# Thief

Native shared-engine profession. Entry point `thief.html`. `definition.ts`
composes the Core-first tuple from `modules.ts`; a runtime contains Core plus at
most one of Daredevil, Deadeye, Specter, or Antiquary. Core owns shared
initiative, stealth, weapons, and traits; each specialization owns a complete
vertical slice under `specializations/<name>/`.

## Data

- API identity snapshot: 2026-07-28 (official GW2 API).
- Refresh: `npm run update:profession-data -- --profession Thief`.
- Runtime simulation is network-free. Initiative, skill mechanics, modifiers,
  and other non-API behavior are checked into owner-local `skills/`, `traits/`,
  and `mechanics/` modules.

## Implemented systems

- **Core** — nine terrestrial weapon families with exact main-hand/off-hand
  matching for every dual-wield and empty-offhand slot-3 skill; shared
  initiative, passive regeneration, explicit weapon-skill costs, weapon-swap
  preservation, Preparedness, and initiative-gain traits; stealth stacking,
  Revealed, active-weapon stealth attacks, and core/Daredevil stolen skills.
- **Daredevil** — physical-skill endurance, the Fist Flurry/Palm Strike window,
  delayed Pulmonary Impact, staff packets, and its damage-window traits.
- **Deadeye** — Mark, malice, Kneel, malicious stealth attacks, and per-malice
  Backstab scaling.
- **Specter** — Shadow Force pool and Shadow Shroud transitions, Scepter and
  shroud hit packets, wells, Siphon, and initiative-to-Shadow-Force gain.
- **Antiquary** — artifact uses with all artifacts selectable, per-cast Double
  Edge outcomes, backfire state, and persistent Antiquary summons.

Core Steal exposes Throw Gunk, Consume Plasma, and Whirling Axe as its standard
stolen-skill choice pool. Double Edge success/backfire is saved per rotation
entry; simulation never uses unseeded randomness.

## Modeling boundaries

Single-target, outgoing-damage focused. Incoming attacks, active defense, ally
support (Shallow Grave, Consume Shadows, Traversing Dusk, Panaku's Ambition,
Hungering Darkness, etc.), pathing, secondary targets, and competitive (PvP/WvW)
splits are out of model.
