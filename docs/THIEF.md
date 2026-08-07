# Thief simulator

The Thief implementation uses the checked-in Guild Wars 2 API identity
snapshot from July 28, 2026 plus manually reviewed PvE mechanics encoded in
the profession modules.

## Implemented systems

- Nine terrestrial weapon families and exact main-hand/off-hand matching for
  every dual-wield and empty-offhand slot-3 skill.
- Shared initiative, passive regeneration, explicit weapon-skill costs, weapon
  swap preservation, Preparedness, and initiative-gain traits.
- Stealth stacking, Revealed, active-weapon stealth attacks, and Deadeye
  malicious stealth attacks.
- Core/Daredevil stolen skills, Deadeye-specific stolen skills and
  Mark/malice/Kneel, Daredevil endurance and dodge replacements, and Specter
  Shadow Force and Shadow Shroud transitions. The maximum Shadow Force pool is
  69% of maximum health and drains by 2% of that pool per second in shroud.
- Antiquary artifact slots, deterministic or player-choice artifact draws,
  Double Edge outcomes, Reshuffle, backfire state, and persistent Antiquary
  summons.
- Current researched damage, condition, control, boon, cooldown, ammo, and
  chain packets, plus a validated coverage disposition for all 108 traits.

The default stolen skill is Throw Gunk, matching the standard raid-golem
scenario. Artifact draws and Double Edge outcomes are saved deterministic
scenario choices; simulation never uses unseeded randomness.

## Data provenance

Refresh API identity data with
`npm run update:profession-data -- --profession Thief`, which runs
`scripts/data/update-profession-api-data.mjs`. Runtime simulation is network-free.
Initiative and other non-API mechanics are manually reviewed and checked into
the mechanics modules; the repository does not currently track per-record
Wiki revision metadata.
