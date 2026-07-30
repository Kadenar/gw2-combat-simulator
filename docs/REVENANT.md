# Revenant simulator

The Revenant implementation uses the checked-in Guild Wars 2 API identity
snapshot from July 28, 2026 plus manually reviewed PvE mechanics encoded in
the profession modules.

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

Refresh API identity data with
`npm run update:profession-data -- --profession Revenant`, which runs
`scripts/update-profession-api-data.mjs`. Runtime simulation is network-free.
Energy, upkeep, and other non-API mechanics are manually reviewed and checked
into the mechanics modules; the repository does not currently track
per-record Wiki revision metadata.
