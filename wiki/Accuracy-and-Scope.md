# Accuracy and scope

The simulator is a controlled combat model. Results are estimates for comparing builds and rotations, not guaranteed
in-game DPS.

## What it models

- Skill timing, cooldowns, ammo, and profession resources
- Strike and condition damage
- Boons, conditions, traits, equipment effects, and damage modifiers
- Weapon swaps, skill chains, transformations, and supported profession mechanics
- Reproducible seeded proc outcomes and weapon-strength sampling

## Main boundaries

The model focuses on single-target PvE outgoing damage. Unless a profession's implementation notes say otherwise, it
does not attempt to reproduce:

- Movement, pathing, latency, or player execution errors
- Incoming attacks and most active defense
- Ally healing, barrier, cleansing, revival, or other support-only effects
- Secondary targets and encounter-specific mechanics
- Competitive PvP or WvW balance splits
- Unknown, undocumented, or newly changed game behavior

Player health stays at 100% during combat simulation. Only the isolated attribute preview may vary it; target health
remains modeled.

Both modes use seeded rolls for critical-proc eligibility and other chance-based effects. Deterministic mode uses
midpoint weapon strength and defaults to averaged critical damage; the **Critical damage** setting can use individual
rolls instead. Stochastic mode samples weapon strength per activation and always uses rolled critical damage. A single
seed represents one set of outcomes, not their expected average. Imported logs can also differ because of encounter
conditions and unmodeled effects.

## Comparing results

Use the simulator to compare two setups under identical assumptions, inspect why their damage differs, and identify
questions worth validating in game.

Keep targets, boons, seeds, and observation windows fixed so their effects do not obscure the build or rotation change.

For profession-specific boundaries, see [Profession support](Profession-Support).
