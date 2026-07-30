# Engineer simulator

The Engineer implementation uses the checked-in Guild Wars 2 API identity
snapshot from July 28, 2026 plus manually reviewed PvE mechanics encoded in
the profession modules.

## Implemented systems

- Eight terrestrial weapon families and both configured equipment sets.
- Engineering kits as weapon-bar replacements. Equipping or stowing a kit
  emits a sigil-swap trigger without changing the equipped weapon set.
- Tool-belt skills derived from selected heal, utility, and elite skills.
- Holosmith Photon Forge, passive heat generation, skill heat, the six-second
  kit lockout, overheat, and the current piecewise cooling rates.
- Mechanist trait-selected F1–F3 commands, summon/recall state, and a persistent
  jade-mech basic attack.
- Amalgam F2–F4 morph loadout persistence and Evolve state.
- Ammo, cooldowns, autoattack chains, current damage packets, conditions,
  controls, boons, and modeled offensive traits.

Every catalog trait has a validated coverage entry. Effects outside a
single-target damage rotation—such as personal defense, ally support, movement,
and competitive-mode behavior—are explicitly classified out of model.

## Data provenance

Refresh API identity data with
`npm run update:profession-data -- --profession Engineer`, which runs
`scripts/update-profession-api-data.mjs`. Runtime simulation is network-free.
Non-API coefficients and state-machine rules are manually reviewed and
checked into the mechanics modules; the repository does not currently track
per-record Wiki revision metadata.
