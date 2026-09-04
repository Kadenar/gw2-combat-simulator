# Builds and templates

A build contains the character configuration and simulation assumptions used to resolve a rotation.

## Build configuration

The editor includes:

- Equipment attributes, weapons, runes, sigils, relics, food, utility, and infusions
- Specializations and traits
- Heal, utility, and elite skills
- Profession-specific loadouts and mechanics
- Permanent boons, target state, and other simulation assumptions

Calculated attributes update when the build changes. Dynamic effects such as temporary boons, weapon swaps, and
profession modifiers resolve during simulation rather than being permanently added to the displayed attributes.

## Templates

Included templates provide a matching build and rotation. Select a template to load both, or use its **•••** menu to load
only one part.

Templates may display a reference DPS. Treat it as a regression target for that saved build and rotation, not a promised
in-game benchmark.

If you customize a loaded template, the selected tile is marked as modified. The temporary **Undo** action restores the
build that existed before the template was loaded.

## Import, export, and reset

- **Export** downloads a portable build JSON file.
- **Import** validates and loads a build JSON file for the active profession.
- **Reset** replaces the current build with that profession's default configuration.

Rotations are saved separately. Export the build and rotation together when sharing a complete setup.

## Reliable comparisons

For an A/B comparison, keep the rotation and simulation assumptions fixed while changing one build choice. Then reverse
the process: keep the build fixed while changing one part of the rotation.

Next: [Rotation builder](Rotation-Builder).
