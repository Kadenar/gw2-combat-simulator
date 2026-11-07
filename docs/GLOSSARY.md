# Simulator terminology

These terms describe concepts used by the simulator. Use the [module map](architecture/MODULES.md) to locate their
implementations.

## Builds and content

**Build**: A player's equipment, trait choices, selected skills, and combat assumptions.

**Rotation**: The ordered actions a simulation attempts, including casts, waits, and explicit combat start.

**Preset**: A saved build and its associated rotation, with catalog metadata for browsing and comparison.

**Profession family**: A base profession together with its elite specializations.

**Core**: The shared content and mechanics available within a profession family.

**Catalog**: The skills, traits, and other declarations available to an editor or selected simulation.

**Build context**: The calculation context that turns one build and its selected game data into attributes and
simulation inputs.

**Patch preview**: A selectable set of upcoming balance changes applied to live content.

## Execution and observation

**Cast**: One attempt to activate a skill. Acceptance, commitment, and completion describe different points in its
execution.

**Commitment**: The point at which an activation's effects become eligible to survive cancellation under their ownership
rules.

**Packet**: An individual combat effect submitted for resolution.

**Trait trigger**: A reaction that creates work when a selected trait's conditions are met.

**Lifetime ownership**: The association used to decide whether pending work remains eligible to execute after a cast,
companion, or effect changes state.

**Planning state**: An observation of available actions and combat state at an inspected rotation position. It is not a
resumable checkpoint.

**Observation window**: The interval through which a run resolves effects and produces results, potentially extending
beyond the entered rotation.

**Combat boundary**: A start or end that gates combat effects or reporting within the simulation timeline.

**Isolated occurrence**: One skill activation measured with selected context for the skill-damage preview.

## Log import

**Source action**: A cast record or evidence-based inference retained from an imported log before simulator conversion.

**Normalized action**: A source action mapped to a represented simulator skill or composite action.

**Replay command**: A simulator action produced from normalized log actions and their timing.

**Opener**: The preparation and initial actions at the beginning of a rotation. A combat log may omit part of it.
