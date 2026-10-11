# EVTC rotation reconstruction

The simulator can reconstruct a rotation from a local ArcDPS `.evtc`, `.evtc.zip`, or `.zevtc` combat log. Import runs
entirely in the browser and does not upload the log.

For the implementation-level reference, including parser behavior, safety limits, profession-specific inference, and
known limitations, see the colocated [EVTC analyzer documentation](../js/games/gw2/integrations/logs/evtc/README.md).

## Import flow

1. Open the simulator page for the recorded profession and specialization.
2. Select **Load Rotation**.
3. Choose the EVTC or compressed EVTC file.
4. Review the reconstructed rotation and any import warnings before using it for analysis.

The importer:

- decompresses and validates supported archives;
- parses the raw EVTC agent, skill, and combat-event tables;
- selects the player matching the active profession and specialization;
- converts recorded casts, explicit EI finder results, waits and represented weapon/state changes;
- resolves recorded skills against the active simulator catalog; and
- converts the result into normal simulator rotation commands.

If several matching players are equally plausible, import stops instead of silently choosing one.

## Reconstruction boundaries

An EVTC file records combat events, not keyboard input. Some actions have no unique event, share evidence with another
skill, begin before the log, or are generated automatically by traits and profession mechanics.

The importer follows explicit supported EI rules and leaves missing setup for manual editing. Initial buffs, existing
minions, later casts and resource requirements do not construct a preparation sequence. Every successful import shows
this notice once:

> The log may omit opening casts or pre-combat setup. Review and complete the opener before simulating.

Source timestamps and durations remain separate from simulator command conversion. Typical independent warnings include:

- an inferred instant cast;
- a recorded skill missing from the simulator catalog;
- an animation without a matching stop event; or
- an interrupted cast without safe simulator commit timing.

Automatic effects already modeled by the simulator are not inserted as player actions. Always review imported rotations
before treating them as benchmark reproductions.

## Encounter-end inputs

Shared EVTC reconstruction keeps only actions whose reconstructed start is strictly before the encounter boundary.
Starts exactly at the boundary or later are excluded for every profession, including weapon swaps, buff transitions, and
EI-inferred instant actions. Mirage and Druid have no post-encounter grace period.

The boundary is computed once from the earliest death or combat exit of an agent whose profession code matches the EVTC
encounter ID. This remains a heuristic: temporary combat exits, multiple matching targets, or encounter IDs that do not
identify an agent can make it incomplete. With no matching target end event, inputs remain unbounded.

A cast that starts before the boundary retains its recorded duration, even when its stop or split-animation finish
occurs later. Precombat inputs remain eligible. This input window does not set the simulator's damage observation
duration. With no surviving actions, import fails with the no-actions error.

## Development tools

Build the compiled modules first:

```sh
npm run build:modules
```

Inspect a log without opening the browser:

```sh
node scripts/analysis/analyze-evtc.mjs <fight.evtc|fight.evtc.zip|fight.zevtc>
```

Reconstruct simulator commands:

```sh
node scripts/analysis/reconstruct-evtc-rotation.mjs <fight.evtc|fight.evtc.zip|fight.zevtc>
```

Add `--timeline` to reconstruction output for source and normalized actions. See the
[script guide](../scripts/README.md#analysis-tools) for other diagnostics, including Overload Fire projectile counts.

The original EVTC is preferred when available. For reconstruction from a public Elite Insights report, use the
[dps.report adapter](../js/games/gw2/integrations/logs/dps-report/README.md).
