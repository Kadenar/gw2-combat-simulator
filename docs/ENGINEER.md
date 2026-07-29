# Engineer simulator

The Engineer implementation uses the generated Guild Wars 2 API identity
snapshot from July 28, 2026 and checked-in PvE Wiki research for terrestrial
mechanics omitted by the API.

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

`scripts/update-profession-data.mjs` owns API identity data.
`scripts/update-profession-wiki-data.mjs` owns the checked-in Wiki mechanics
research. Runtime simulation is network-free. Each researched skill stores its
source URL, revision ID, revision date, and PvE facts.
