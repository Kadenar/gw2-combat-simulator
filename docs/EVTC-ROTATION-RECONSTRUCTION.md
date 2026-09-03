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
- reconstructs casts, waits, weapon swaps, precasts, and supported profession state;
- resolves recorded skills against the active simulator catalog; and
- converts the result into normal simulator rotation commands.

If several matching players are equally plausible, import stops instead of silently choosing one.

## Reconstruction boundaries

An EVTC file records combat events, not keyboard input. Some actions have no unique event, share evidence with another
skill, begin before the log, or are generated automatically by traits and profession mechanics.

The importer therefore uses conservative profession-specific rules and reports uncertainty. Typical warnings include:

- an inferred instant cast;
- a recorded skill missing from the simulator catalog;
- an animation without a matching stop event; or
- an interrupted cast without safe simulator commit timing.

Automatic effects already modeled by the simulator are not inserted as player actions. Always review imported
rotations before treating them as benchmark reproductions.

## Source layout

```text
js/games/gw2/integrations/logs/
├── lib/          Source-neutral reconstruction contracts and scheduling
├── evtc/         Raw EVTC parsing, evidence inference, and reconstruction
└── dps-report/   Elite Insights parsing and best-effort reconstruction
```

The EVTC adapter is under `js/games/gw2/integrations/logs/evtc/`. Shared logic belongs in `../lib/`; source-specific
EVTC behavior remains in the adapter.

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

The original EVTC is preferred when available. For reconstruction from a public Elite Insights report, use the
[dps.report adapter](../js/games/gw2/integrations/logs/dps-report/README.md).
