# Boss encounter authoring

Status: authoring and single-target health-driven execution implemented. Multi-target, segmented-health, and
mechanic-driven execution remain pending.

## Workflow

Opening Bosses restores the selected saved scenario. On the first visit it loads Vale Guardian with a copy of the
current Golem build and rotation. There is no Create Scenario step.

Bosses uses the existing Golem gear editor, skill palette, rotation timeline, and editing controls. The encounter owns
one continuous rotation with one undo history. Returning to Golem restores its independent build and rotation.

Encounter settings sit **directly below the DPS strip inside the rotation builder**, before the proc and event logs.
Boss configuration is a borderless disclosure, expanded on first load and styled like Procs. Its open state survives
scenario edits and result updates. Expanding it grows the page downward without reducing the timeline height; focus mode
scrolls the builder vertically to retain that space.

The configuration controls are:

1. Choose a boss and difficulty, when applicable.
2. Enter the other squad members' DPS for each damage phase, excluding the simulated player.
3. Enter each split's duration in seconds.
4. Build the rotation using the existing rotation editor.

The selected boss supplies the phase sequence automatically. Users do not create, delete, select, or author separate
rotations for phases. Changing boss or difficulty replaces encounter inputs while retaining the build and rotation.
Scenario names follow the selected boss. New and Duplicate sit beside the scenario selector. Each scenario has a close
button inside that selector, matching the Golem build selector. Closing an inactive scenario keeps the current
selection; closing the active scenario selects a neighbor. The final scenario cannot be closed, matching Golem and
preserving its build, rotation, and encounter inputs.

The shared header Import and Export buttons transfer the complete scenario (encounter inputs, build, and rotation) in
Bosses. In Golem they retain the existing build import and export behavior.

## Encounter data

Health totals come from actual Elite Insights reports, with per-mode provenance retained in
[the health evidence catalog](BOSS-HEALTH-SOURCES.md). Freezie and Cold War / Varinia are excluded. Multiple targets
retain separate totals; segmented bars are preserved. The current authoring preview displays the first primary target,
so it does not yet describe a complete multi-target health progression.

[Phase definitions](../js/games/gw2/app/boss-scenarios/phases.ts) supply health thresholds or named mechanic stages,
with a source for each encounter. Health gates and timed or event-driven mechanics are distinct. Repeating mechanics
currently expose a repeating cycle's inputs; independently editing each repetition is not implemented. These authoring
profiles do not model every overlapping mechanic. Execution currently accepts a single non-segmented EI target with
health-driven damage phases. Other encounters remain available for authoring and display an explicit execution
limitation.

## Reporting

Encounter metrics use the existing DPS-strip styling: total target health, next transition, damage required, current
health, estimated time to threshold, phase DPS, and overall DPS. Supported encounters update these values at the end of
the authored rotation. Each visited phase also shows its player DPS beneath its group-DPS input. Unsupported encounter
results display Unavailable; Golem preview results are not presented as boss simulation results. Report provenance stays
in offline maintenance documentation and the source manifest; the UI, runtime health catalog, and scenario exports
contain no report URLs.

The existing rotation timeline starts a full-width section for each observed phase and split. Its label occupies its own
row, followed by that phase's existing weapon rows and skill tiles; transitions never share a skill row with the
previous phase. Split labels say Invulnerable, and actions started during splits have amber outlines. Skill and wait
tooltips identify their starting phase and transitions during the action. These markers are read-only; editing group
DPS, split duration, or rotation recalculates their positions. Only phases reached by the simulated rotation appear,
followed by Boss defeated if reached.

## Execution

The engine applies the authored group DPS once per second during damage phases, alongside the player's actual simulated
damage. Reaching a boss-defined threshold starts its split automatically. Group damage pauses during the split, and the
next damage phase starts after the authored duration. Skills, cooldowns, resources, buffs, and the rotation cursor
continue across transitions. Blank split durations mean zero seconds. The first squad tick occurs one second after each
damage phase starts. Target-facing hits and new conditions are rejected during splits; existing conditions expire
normally and cannot bank downtime damage. Separate split targets are not yet simulated.

Boss health reaching zero ends damage and encounter scoring; the rotation remains editable. The preview advances to the
end of the authored commands, including waits, rather than running on a real-time wall clock. Phase DPS uses that
phase's damage and elapsed time. Overall boss DPS uses boss damage divided by total encounter time, including splits, so
it decreases during downtime. Time-to-threshold estimates combine the current phase?s authored group DPS and measured
player DPS. They are estimates, not forecasts of future skill usage or exact tick deadlines. Encounter squad DPS
replaces permanent golem-condition environmental damage to avoid counting the squad twice. Pure health reporting bands
retain excess damage; invulnerability gates clamp the triggering packet at the transition.

Player health remains fixed at 100%. Incoming damage and variable player health are outside scope.

## Persistence and validation

Version 2 scenario documents store the canonical build with its continuous rotation and only DPS/duration inputs per
predefined phase. Imports validate the profession, boss, difficulty, exact health evidence, phase sequence, non-negative
finite inputs, and rotation commands. Local persistence is separate from Golem.

Old version 1 prototype drafts are left untouched in their previous storage key and are not loaded or migrated. They
used per-phase rotations, which the current document format does not support. Invalid saved data is preserved rather
than overwritten; the UI reports when new work must be exported instead of saved.
