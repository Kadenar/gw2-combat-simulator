# Scripts

Project scripts are grouped by responsibility:

- `analysis/`: standalone combat-log analysis tools.
- `build/`: build cleanup, validation, and deployment helpers.
- `data/`: Guild Wars 2 API snapshot and generated-data maintenance.
- `testing/`: test loaders and fixture generation.

Use the npm commands in the root `package.json` for routine workflows.

Combat log analyzers:

- `node scripts/analysis/analyze-evtc.mjs <fight.evtc|fight.zevtc>` reads a
  local ArcDPS log.
- `node scripts/analysis/analyze-dps-report.mjs <report.html|dps.report URL>`
  reads the Elite Insights data embedded in a saved or remote report. Add
  `--summary`, `--player=<index|name|account>`, or `--phase=<index|name>` to
  narrow the output.
