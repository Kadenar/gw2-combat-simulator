# Log analyzers

The adapters convert available cast evidence into simulator commands. Missing setup remains editable after import.

- `evtc/` parses raw ArcDPS records and applies explicit Elite Insights cast finders.
- `dps-report/` validates EI JSON and imports the selected player's supplied rotation intersecting the selected phase.
- `wingman/` reshapes a gw2wingman log into the same document `dps-report/` validates, then reuses its rules unchanged.
- `shared/rotation/` owns source-independent identities, represented composites, proc filtering and replay scheduling.

All three return source actions separately from normalized actions, commands, time origins and warnings. Source
durations are retained; simulator conversion can quantize interruptions, encode overlaps and add ordinary waits using
catalog timing. It does not modify resource defaults, cooldowns or saved rotations to repair missing inputs.

Shared command construction accepts an already-resolved identity and the adapter's interrupt decision. EI retains
selected-skill name preference; EVTC retains numeric identity, profile dodges, packet proof, and Continuum Split
boundaries. Each adapter still supplies its own policy directly to `buildReplayTimeline`.

`RecordedRotationAction.expectedDurationMs` is the nominal duration of the represented input, including any composite or
variant normalization. Unknown durations are absent internally and become `null` in results. The original source actions
retain their observed durations. Normalization receives explicit swap/accuracy flags, while raw EVTC evidence may omit
them. `sourceActionIndex` identifies the original input independently of normalization ordering; EVTC restores its
original event index and evidence after normalization. A synthesized input has no source index and uses `synthesized`
evidence, never a borrowed animation or event index. The EVTC mapping remains responsible for those distinctions and for
damage-proven Vindicator observations.

Every successful log import returns this notice once:

> The log may omit opening casts or pre-combat setup. Review and complete the opener before simulating.

Native saved-rotation imports do not receive the notice. See the adapter READMEs and
[EI alignment](../../../../../docs/LOG-IMPORT-EI-ALIGNMENT.md) for evidence rules and coverage limits.

For upstream parser updates, follow [Keeping log imports aligned with EI](EI-PARSER-MAINTENANCE.md), including the
update workflow, local ownership map, validation steps, and pinned source references.
