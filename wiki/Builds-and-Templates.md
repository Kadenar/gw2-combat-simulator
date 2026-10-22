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

Included templates provide a matching build and rotation. Select a template to load both, or use its **•••** menu to
load only one part.

Templates may display a reference DPS. Treat it as a regression target for that saved build and rotation, not a promised
in-game benchmark.

If you customize a loaded template, the selected tile is marked as modified. When a template or one of its parts
replaces the current tab's setup, **Undo** restores the previous build, rotation, and reset baseline. Loading a template
into a new tab, including through **+ New → Browse templates…**, does not offer this Undo action.

## Import, export, and reset

- **Export** offers **Build only** or **Build + rotation** JSON downloads.
- **Import** validates and loads a build JSON file for the active profession.
- **Reset build** restores the active tab's saved reset baseline, or the profession defaults if no baseline is associated
  with the tab. Loading a complete template saves its build and matching rotation as the baseline. **Load build only**
  saves the loaded build together with the rotation already in the tab. **Load rotation only** leaves the existing
  baseline unchanged.

**Save Rotation** exports the rotation separately. Use **Build + rotation**, or share both separate files, for a
complete setup.

## Reliable comparisons

For an A/B comparison, keep the rotation and simulation assumptions fixed while changing one build choice. Then reverse
the process: keep the build fixed while changing one part of the rotation.

Next: [Rotation builder](Rotation-Builder).
