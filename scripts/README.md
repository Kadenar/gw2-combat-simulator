# Scripts

Project scripts are grouped by responsibility:

- `analysis/`: combat-log reconstruction, report inspection, and supported-build metrics.
- `build/`: generated-output cleanup and validation.
- `data/`: Guild Wars 2 API snapshots and generated-data maintenance.
- `lib/`: support shared by command-line scripts.
- `patch-preview/`: local patch-preview authoring and promotion reporting.
- `testing/`: the loader that maps source-facing imports to compiled `dist/js` modules.

Use the npm commands in the root `package.json` for routine workflows.

## Analysis tools

- `npm run benchmarks:compare` simulates every rotation-backed manifest preset and reports DPS values more than 1%
  away from `benchmarkDps`. Pass `-- --absolute-dps` for a fixed 100 DPS tolerance or `-- --commit` to update every
  rounded manifest value.
- `npm run build:modules && node scripts/analysis/capture-supported-build-metrics.mjs [profession...]` prints current
  deterministic preset metrics as JSON.
- `npm run build:modules && node scripts/analysis/analyze-evtc.mjs <fight.evtc|fight.evtc.zip|fight.zevtc>` inspects a
  local ArcDPS log. Add `--summary` or the documented `--debug-*` filters to narrow the output.
- `npm run build:modules && node scripts/analysis/reconstruct-evtc-rotation.mjs <fight.evtc|fight.evtc.zip|fight.zevtc>`
  reconstructs simulator commands from a local ArcDPS log.
- `npm run build:modules && node scripts/analysis/reconstruct-dps-report-rotation.mjs <dps.report URL>` reconstructs
  simulator commands from public Elite Insights JSON. Add `--build=<build.json>` when polymorphic skill choices must
  match a saved build.
- `node scripts/analysis/analyze-dps-report.mjs <report.html|dps.report URL>` inspects Elite Insights data embedded in a
  saved or remote report. Add `--summary`, `--player=<index|name|account>`, or `--phase=<index|name>` to narrow the
  output.

Patch-preview commands are documented in [Patch preview](../docs/architecture/PATCH-PREVIEW.md).
