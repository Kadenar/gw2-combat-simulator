# Importing rotations and combat logs

Select **Load Rotation** in the rotation builder. The import dialog previews a rotation before it replaces the current
one.

## Supported inputs

- Rotation JSON exported by the simulator
- Uncompressed `.evtc` logs
- Compressed `.evtc.zip` or `.zevtc` logs
- dps.report report data or a supported dps.report URL
- A matching included preset rotation

Use the simulator page for the recorded player's profession. The active build should also match the log's weapons,
specialization, and selected skills before applying the reconstructed rotation.

## Reconstruction behavior

The importer extracts supported player actions, matches them to simulator skills, and converts them into rotation
commands. Review the preview's observations and warnings before applying it.

Reconstruction is not a replay of the full encounter. Unsupported actions, target mechanics, movement, latency, and
unmodeled effects may be omitted or represented approximately. After import:

1. Review every warning.
2. Confirm the build and starting profession state.
3. Check the first weapon set, attunement, legend, form, or other profession-specific state.
4. Compare the reconstructed order with the source log.
5. Save the cleaned rotation as JSON if you want to reuse it.

For implementation details, see
[EVTC Rotation Reconstruction](https://github.com/Kadenar/gw2-combat-simulator/blob/main/docs/EVTC-ROTATION-RECONSTRUCTION.md).
