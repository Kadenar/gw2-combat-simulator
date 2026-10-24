# Boss encounter authoring

Status: encounter execution supports independent targets, sequential targets, replacement health bars, health gates, and
authored timed windows. The shared Golem build and rotation editors remain unchanged.

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
2. Enter the other squad members' DPS for each damage phase, excluding the simulated player. Parallel phases have one
   input per target and a selector for the target attacked by your rotation.
3. Enter each split's duration in seconds. Mechanic-driven damage windows also expose an expected duration.
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
retain separate totals and live HP. The DPS strip follows the player-selected target; the configuration also lists each
target's HP. Replacement bars use their own maximum and starting percentage, not the encounter's summed damage budget.

[Phase definitions](../js/games/gw2/app/boss-scenarios/phases.ts) supply health thresholds or named mechanic stages,
with a source for each encounter. Health gates and timed or event-driven mechanics are distinct. Repeating mechanics
expose a cycle's inputs and repeat them until defeat; independently editing each repetition is not implemented. These
authoring profiles do not model every overlapping mechanic. All selectable modes compile to executable encounter plans.

## Reporting

Encounter metrics use the existing DPS-strip styling: total target health, next transition, damage required, current
health, estimated time to threshold, phase DPS, and overall DPS. Values update at the end of the authored rotation. Each
visited phase also shows its player DPS beneath its group-DPS input; repeated phases show their latest visit. Timed
windows show their remaining time beside the health gate. Report provenance stays in offline maintenance documentation
and the source manifest; the UI, runtime health catalog, and scenario exports contain no report URLs.

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

Completion of the encounter's final target phase ends damage and encounter scoring; the rotation remains editable. The
preview advances to the end of the authored commands, including waits, rather than running on a real-time wall clock.
Phase DPS uses that phase's damage and elapsed time. Overall boss DPS uses boss damage divided by total encounter time,
including splits, so it decreases during downtime. Time-to-threshold estimates combine the current phase's authored
group DPS and measured player DPS. They are estimates, not forecasts of future skill usage or exact tick deadlines.
Encounter squad DPS replaces permanent golem-condition environmental damage to avoid counting the squad twice. Pure
health reporting bands retain excess damage; invulnerability gates clamp the triggering packet at the transition.

Player health remains fixed at 100%. Incoming damage and variable player health are outside scope.

## Persistence and validation

Version 3 scenario documents store the canonical build with its continuous rotation and DPS/duration/target inputs per
predefined phase. Single-target DPS is a number; parallel DPS is keyed by EI target index and requires a valid player
target index. Imports reject a single number for a parallel phase instead of guessing a distribution. Imports validate
the profession, boss, difficulty, exact health evidence, phase sequence, non-negative finite inputs, and rotation
commands. Local persistence is separate from Golem.

Version 3 uses its own local-storage namespace. Older version 1 and 2 libraries are not read, converted, or overwritten.
They do not prevent a default scenario from opening or new scenarios from saving. Imported older documents are rejected.
Unreadable data in the current namespace is preserved rather than overwritten; only that current-format failure blocks
saving and asks the user to export new work.

Split controls and timeline sections use the selected boss and difficulty's mechanic names from the shared phase plan.
Repeated mechanics retain their split numbers. Names describe the existing authored intervals and do not add or retime
transitions. Examples include Charged Souls for Gorseval, Kernan / Knuckles / Karde for Sabetha, and Rigom and Guldhem
for Samarog. Where no distinct mechanic name is established, descriptive transition labels are used.

## Target and mechanic execution details

- **Xera, Deimos, and Ura:** EI segmented bars supply the active maximum and starting percentage after the authored
  transition. Old conditions cannot jump to the replacement bar. Target-health-dependent traits query the active bar.
- **Twin Largos:** Nikare and Kenut open sequentially to 50%, followed by paired 50%-25% and 25%-0% stages. Each paired
  stage has independent group DPS and an explicit player target. A target stops accepting damage at its gate; unused
  damage is not redirected. The shared transition waits for both targets, then runs the authored travel duration. This
  is a synchronized-platform authoring model; separate overlapping platform travel and portal strategies are not
  modeled. The [encounter guide](https://wiki.guildwars2.com/wiki/Mythwright_Gambit) supplies the platform sequence.
- **Conjured Amalgamate:** authored arm intervals precede the burn windows. Ending an arm interval removes 10% of the
  boss's maximum HP as mechanic damage, excluded from player DPS. The first two windows end at 50% / 25% or their
  authored timeout, whichever happens first. The final window continues to defeat. The default 40-second windows are
  editable planning assumptions, not EI-derived timer measurements. Arm health, conjured sword damage, and the second
  arm's destruction during the final burn are not individually simulated. The
  [encounter guide](https://snowcrows.com/guides/raids/conjured-amalgamate) describes the arm and burn sequence.
- **Fraenir, Aetherblade Hideout, and Harvest Temple:** phases select the appropriate EI target rather than applying the
  entire encounter's damage to the first target. Fraenir's return restores its authored 25% bar; Echo includes phantom
  and laser intervals; the final two Harvest Temple stages share Soo-Won's health.
- **Voice and Claw / Kela:** timed stages repeat without resetting HP. Their default 60-second windows are editable
  authoring assumptions, not fixed mechanic timers. Voice and Claw's merged interval remains damageable; damage is
  authored against the two retained health pools, without simulating the merged actor's health redistribution. Kela's
  storm timing is authored rather than calculated from crab delivery.

Group damage ticks once per second independently for each active target. Player damage applies only to the selected
phase target. Conditions retain target and bar ownership and cannot transfer to another boss when selection changes.
Pure reporting bands preserve overkill only while the same target and health bar remain active. Estimated transition
time is the slowest target's remaining damage divided by its own rate, capped by an authored window deadline. It does
not assume that idle DPS from a phased target moves to another target. Repeated windows end immediately on defeat.

## Automatic target armor

Boss and difficulty selection supplies each target's armor from the EI evidence catalog. Runtime hits use the current
phase's selected target, so sequential targets and player-target selections do not keep the first boss's armor. Armor
appears in the encounter DPS strip. Bosses keeps movement and skill activation rate editable in the simulation settings'
Target section, while omitting health, starting health, armor, and target-specific profession assumptions. Golem retains
all target controls and its saved preferences. Authored group DPS is already damage dealt and is not scaled by armor a
second time. Conditions and armor-ignoring packets keep their existing formulas.

## Boss analysis

Analysis uses the active Bosses scenario and the existing Golem result layout: summary, damage breakdown, DPS and effect
charts, and modifier contributions. The scenario selector remains available. Empty scenarios link back to Bosses;
results from another workspace or an outdated revision are not presented as current encounter analysis.

An encounter table reports each observed phase and named split with elapsed bounds, duration, player damage and phase
DPS, group damage and DPS excluding the player, and cumulative player DPS. Unfinished stages are marked in progress;
repeated cycles get distinct entries. Separate target rows show each current health bar and armor without combining
unrelated pools.

The existing chart range controls offer Full Fight and observed damage phases instead of Golem health bands. Full Fight
includes split time, so cumulative DPS falls during invulnerability; selecting a phase restarts its damage clock and
crops its effect timelines. Splits remain in the table and chart transition markers, without separate range buttons.
Damage breakdown and modifier contributions cover the full simulated encounter. RNG and modifier comparison jobs inherit
the same boss configuration as the baseline simulation.

Phase DPS is available from the DPS strip's existing disclosure style, replacing the result text beneath encounter
inputs. The disclosure lists observed damage phases, including partial phases and repeated cycles. Chart transition
labels use measured collision lanes and expand the canvas downward without shrinking the plot or moving transition
times. Long labels are shortened only when wider than the plot; full names remain in the encounter table.
