# EVTC rotation import navigation

The simulator imports local ArcDPS logs through its browser log adapter. The
[EVTC implementation](../js/games/gw2/integrations/logs/evtc/) determines supported formats, evidence rules, and limits.

## Use the importer

Open the recorded profession, select Load Rotation, choose the log, and review the resulting actions and warnings. Logs
can omit preparation; the editor lets the user complete an opener after import.

The [EVTC adapter guide](../js/games/gw2/integrations/logs/evtc/README.md) provides background.
[EI alignment](LOG-IMPORT-EI-ALIGNMENT.md) links to evidence and replay owners. For supplied report rotations, start
with the [dps.report adapter](../js/games/gw2/integrations/logs/dps-report/).

## Follow an import

| Stage                                      | Owner                                                                                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Browser file selection and warning display | [app/import-export/logs/](../js/games/gw2/app/import-export/logs/)                                                                                                       |
| Archive decoding and binary parsing        | [decompression.ts](../js/games/gw2/integrations/logs/evtc/decompression.ts), [parser.ts](../js/games/gw2/integrations/logs/evtc/parser.ts)                               |
| Recording format and boundaries            | [recording.ts](../js/games/gw2/integrations/logs/evtc/recording.ts)                                                                                                      |
| Recorded animations                        | [rotation/animations.ts](../js/games/gw2/integrations/logs/evtc/rotation/animations.ts)                                                                                  |
| Player and encounter selection             | [rotation/players.ts](../js/games/gw2/integrations/logs/evtc/rotation/players.ts), [rotation/encounter.ts](../js/games/gw2/integrations/logs/evtc/rotation/encounter.ts) |
| Reconstruction orchestration               | [rotation/reconstruct.ts](../js/games/gw2/integrations/logs/evtc/rotation/reconstruct.ts)                                                                                |
| Shared identity and replay conversion      | [shared/rotation/](../js/games/gw2/integrations/logs/shared/rotation/)                                                                                                   |

Source evidence and simulator commands are separate representations. Inspect both when an imported cast looks wrong; the
replay conversion can affect timing without changing the retained source record.

## Command-line tools

Build modules, then inspect or reconstruct a local log:

```sh
npm run build:modules
node scripts/analysis/analyze-evtc.mjs path/to/fight.zevtc
node scripts/analysis/reconstruct-evtc-rotation.mjs path/to/fight.zevtc --timeline
```

The [script guide](../scripts/README.md#analysis-tools) lists related tools.
[Log integration tests](../tests/games/gw2/integrations/logs/) cover parser and replay behavior.
