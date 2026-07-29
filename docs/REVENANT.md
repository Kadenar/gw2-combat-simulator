# Revenant simulator

The Revenant implementation uses the generated Guild Wars 2 API identity
snapshot from July 28, 2026 and checked-in PvE Wiki mechanics research.

## Implemented systems

- Ten terrestrial weapon families, cooldowns, ammo, chains, and current damage,
  condition, control, and boon packets.
- A profession-owned fixed-bar loadout with exactly two stable legend IDs and
  a validated starting legend.
- Legend-bar replacement, a ten-second legend-swap cooldown, 50-energy reset,
  Charged Mists, and swap-sigil triggers that do not change weapon set.
- Continuous five-energy-per-second regeneration, explicit skill costs,
  concurrent upkeep, and timestamped starvation cancellation.
- Herald facet upkeep and consume flips.
- Renegade warband actor ownership and Soulcleave strike reactions.
- Vindicator Alliance-side state and explicit dodge selection.
- Conduit affinity, legend-specific Release Potential, and Cosmic Wisdom state.
- A validated coverage disposition for all 108 traits.

## Data provenance

`scripts/update-profession-data.mjs` owns API identity data.
`scripts/update-profession-wiki-data.mjs` owns the checked-in Wiki research,
including energy and upkeep fields. Runtime simulation is network-free and each
research record pins its source URL, revision ID, and revision date.
