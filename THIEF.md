# Thief simulator

The Thief implementation uses the generated Guild Wars 2 API identity snapshot
from July 28, 2026 and checked-in PvE Wiki mechanics research.

## Implemented systems

- Nine terrestrial weapon families and exact main-hand/off-hand matching for
  every dual-wield and empty-offhand slot-3 skill.
- Shared initiative, passive regeneration, explicit weapon-skill costs, weapon
  swap preservation, Preparedness, and initiative-gain traits.
- Stealth stacking, Revealed, active-weapon stealth attacks, and Deadeye
  malicious stealth attacks.
- Steal, deterministic raid-golem stolen-skill storage, Daredevil endurance and
  dodge replacements, Deadeye Mark/malice/Kneel, and Specter Shadow Force and
  Shadow Shroud transitions.
- Antiquary artifact slots, deterministic artifact draws and Double Edge
  outcomes, Reshuffle, backfire state, and persistent Antiquary summons.
- Current researched damage, condition, control, boon, cooldown, ammo, and
  chain packets, plus a validated coverage disposition for all 108 traits.

The default stolen skill is Throw Gunk, matching the standard raid-golem
scenario. Artifact draws and Double Edge outcomes are saved deterministic
scenario choices; simulation never uses unseeded randomness.

## Data provenance

`scripts/update-profession-data.mjs` owns API identity data.
`scripts/update-profession-wiki-data.mjs` owns the checked-in Wiki research,
including initiative fields. Runtime simulation is network-free and every
research record pins its source URL, revision ID, revision date, and PvE facts.
