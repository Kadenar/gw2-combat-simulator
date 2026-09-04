# Accuracy and scope

The simulator is a controlled combat model. Results are estimates for comparing builds and rotations, not guaranteed
in-game DPS.

## What it models

- Skill timing, cooldowns, ammo, and profession resources
- Strike and condition damage
- Boons, conditions, traits, equipment effects, and damage modifiers
- Weapon swaps, skill chains, transformations, and supported profession mechanics
- Deterministic expected results and seeded random trials

## Main boundaries

The model focuses on single-target PvE outgoing damage. Unless a profession's implementation notes say otherwise, it
does not attempt to reproduce:

- Movement, pathing, latency, or player execution errors
- Incoming attacks and most active defense
- Ally healing, barrier, cleansing, revival, or other support-only effects
- Secondary targets and encounter-specific mechanics
- Competitive PvP or WvW balance splits
- Unknown, undocumented, or newly changed game behavior

Fixed or expected values may replace random behavior in deterministic mode. Imported logs can also differ because they
contain realized critical hits and encounter conditions.

## Good use

Use the simulator to compare two setups under identical assumptions, inspect why their damage differs, and identify
questions worth validating in game.

## Bad use

Do not treat a result as proof of live-game performance when the comparison changes targets, boons, observation windows,
rotations, or unmodeled encounter conditions.

For profession-specific boundaries, see [Profession support](Profession-Support).
