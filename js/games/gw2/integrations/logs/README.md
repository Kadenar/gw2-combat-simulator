# Log analyzers

The adapters convert available cast evidence into simulator commands. Missing setup remains editable after import.

- `evtc/` parses raw ArcDPS records and applies explicit Elite Insights cast finders.
- `dps-report/` validates EI JSON and imports the selected player's supplied rotation intersecting the selected phase.
- `lib/rotation/` owns source-independent identities, represented composites, proc filtering and replay scheduling.

Both return source actions separately from normalized actions, commands, time origins and warnings. Source durations are
retained; simulator conversion can quantize interruptions, encode overlaps and add ordinary waits using catalog timing.
It does not modify resource defaults, cooldowns or saved rotations to repair missing inputs.

Every successful log import returns this notice once:

> The log may omit opening casts or pre-combat setup. Review and complete the opener before simulating.

Native saved-rotation imports do not receive the notice. See the adapter READMEs and
[EI alignment](../../../../../docs/LOG-IMPORT-EI-ALIGNMENT.md) for evidence rules and coverage limits.
