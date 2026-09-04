# Rotation builder

The rotation builder turns an ordered list of actions into a millisecond-level combat timeline.

## Add and edit actions

- Click an available skill in the palette to append it.
- Select an insertion gap in the timeline, then click a skill to insert it there.
- Use **Undo**, **Redo**, and **Clear** to revise the sequence.
- **Shift+click** an instant-cast skill to fire it during the previous cast.
- **Ctrl+click** a non-instant skill to interrupt it.

Only actions valid for the active build and current combat state can execute. The scheduler tracks cooldowns, ammo,
weapon swaps, resources, skill chains, transformations, and profession mechanics.

![Rotation builder walkthrough](https://raw.githubusercontent.com/Kadenar/gw2-combat-simulator/main/docs/assets/gw2-combat-simulator-rotation-builder.gif)

## Read the timeline

Each row represents a requested action and its scheduled result. Select or inspect a row to see its timing and the active
state around that point in the rotation.

Warnings explain rejected or altered actions. Common causes include:

- A skill is still on cooldown.
- The required resource, weapon set, form, or target state is unavailable.
- The selected build does not contain the requested skill.
- An imported action is not modeled by the active profession.

Do not ignore warnings when comparing results. A rejected action can change every later timestamp and damage event.

## Save and load

- **Save Rotation** downloads the current sequence as JSON.
- **Load Rotation** accepts saved rotation JSON, supported EVTC files, EVTC ZIP files, and dps.report inputs.

Imported combat logs reconstruct supported actions; they do not reproduce every detail of the original encounter. See
[Importing rotations](Importing-Rotations).

Next: [Reading results](Reading-Results).
