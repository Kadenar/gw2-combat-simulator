# Boss encounter authoring

Status: encounter authoring implemented; health-driven simulation pending.

## Workflow

Opening Bosses restores the selected saved scenario. On the first visit it loads Vale Guardian with a copy of the
current Golem build and rotation. There is no Create Scenario step.

Bosses uses the existing Golem gear editor, skill palette, rotation timeline, and editing controls. The encounter owns
one continuous rotation with one undo history. Returning to Golem restores its independent build and rotation.

Encounter settings sit **directly below the DPS strip inside the rotation builder**, before the proc and event logs:

1. Choose a boss and difficulty, when applicable.
2. Enter the other squad members' DPS for each damage phase, excluding the simulated player.
3. Enter each split's duration in seconds.
4. Build the rotation using the existing rotation editor.

The selected boss supplies the phase sequence automatically. Users do not create, delete, select, or author separate
rotations for phases. Changing boss or difficulty replaces encounter inputs while retaining the build and rotation.
Scenario names follow the selected boss. Duplicate, close, import, and export remain available in the scenario toolbar.
Closing removes the selected saved scenario and selects a neighbor. Closing the last scenario loads a fresh default.

## Encounter data

Health totals come from actual Elite Insights reports, with per-mode provenance retained in
[the health evidence catalog](BOSS-HEALTH-SOURCES.md). Freezie and Cold War / Varinia are excluded. Multiple targets
retain separate totals; segmented bars are preserved. The current authoring preview displays the first primary target,
so it does not yet describe a complete multi-target health progression.

[Phase definitions](../js/games/gw2/app/boss-scenarios/phases.ts) supply health thresholds or named mechanic stages,
with a source for each encounter. Health gates and timed or event-driven mechanics are distinct. Repeating mechanics
currently expose a repeating cycle's inputs; independently editing each repetition is not implemented. These authoring
profiles are not yet executable encounter scripts and do not model every overlapping mechanic.

## Reporting

Encounter metrics use the existing DPS-strip styling: total target health, next transition, damage required, current
health, estimated time to threshold, phase DPS, and overall DPS. Until encounter execution exists, live values display
Pending. Golem preview results are not presented as boss simulation results. Source attribution stays in a compact EI
link; explanatory provenance belongs in documentation.

## Planned execution

The engine will apply the authored group DPS once per second during damage phases, alongside the player's actual
simulated damage. Reaching a boss-defined threshold starts its split automatically. Group damage pauses during the
split, and the next damage phase starts after the authored duration. Skills, cooldowns, resources, buffs, and the
rotation cursor continue across transitions. Damage to split targets must not count as damage to the main boss.

Boss health reaching zero ends the encounter. Phase DPS uses that phase's damage and elapsed time. Overall boss DPS uses
boss damage divided by total encounter time, including splits, so it decreases during downtime. Time-to-threshold
estimates must distinguish authored group DPS from measured player contribution.

Player health remains fixed at 100%. Incoming damage and variable player health are outside scope.

## Persistence and validation

Version 2 scenario documents store the canonical build with its continuous rotation and only DPS/duration inputs per
predefined phase. Imports validate the profession, boss, difficulty, exact health evidence, phase sequence, non-negative
finite inputs, and rotation commands. Local persistence is separate from Golem.

Old version 1 prototype drafts are left untouched in their previous storage key and are not loaded or migrated. They
used per-phase rotations, which the current document format does not support. Invalid saved data is preserved rather
than overwritten; the UI reports when new work must be exported instead of saved.
