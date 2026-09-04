# Revenant

Native shared-engine profession. Entry point `revenant.html`. `definition.ts`
is the stable export and composes the Core-first tuple from `modules.ts`. A
runtime contains Core plus at most one of Herald, Renegade, Vindicator, or
Conduit. Core owns the always-active energy, legend,
weapon, upkeep, trait, state, rules, and UI behavior; each specialization owns
a complete vertical slice under `specializations/<name>/`. Only the selected
elite module is present in a given runtime.

## Data

- API identity snapshot: 2026-07-28 (official GW2 API).
- Refresh: `npm run update:profession-data -- --profession Revenant`.
- Runtime simulation is network-free. Energy, upkeep, skill mechanics,
  modifiers, and other non-API behavior are checked into owner-local `skills/`,
  `traits/`, and `mechanics/` modules.

## Implemented systems

- **Core** — ten terrestrial weapon families with cooldowns, ammo, chains, and
  damage/condition/control/boon packets; a fixed-bar loadout with exactly two
  legend IDs and a validated starting legend; legend-bar replacement with a
  ten-second in-combat legend-swap cooldown (none out of combat), 50-energy
  reset, Charged Mists, and swap-sigil triggers; continuous five-energy/sec
  regeneration, explicit skill costs, concurrent upkeep, and timestamped
  starvation cancellation.
- **Herald** — facet upkeep and consume flips.
- **Renegade** — warband actor ownership and Soulcleave strike reactions.
- **Vindicator** — Alliance-side state and explicit dodge selection.
- **Conduit** — affinity, legend-specific Release Potential, and Cosmic Wisdom
  state.

## Modeling boundaries

Single-target, outgoing-damage focused. Incoming attacks, active defense, ally
healing/barrier/cleanse, pathing, secondary targets, and competitive (PvP/WvW)
splits are out of model.
