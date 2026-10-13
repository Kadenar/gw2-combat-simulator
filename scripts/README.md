# Scripts

Project scripts are grouped by responsibility:

- `analysis/`: combat-log reconstruction, report inspection, and supported-build metrics.
- `build/`: generated-output cleanup and validation.
- `data/`: Guild Wars 2 API snapshots and generated-data maintenance.
- `lib/`: support shared by command-line scripts.
- `patch-preview/`: local patch-preview authoring and promotion reporting.

Use the npm commands in the root `package.json` for routine workflows.

Tests and headless scripts use package aliases to load compiled `dist/js` modules directly in Node. Build the modules
before running them; no custom loader is required.

Profession data refreshes run directly from source with the supported Node version. Use
`npm run update:profession-data -- --profession <name>` to refresh metadata and dependent generated outputs together.
Engineer, Revenant, and Ranger load their own supplemental records when selected. Ranger fetches one pet list and the
pet skills the API serves, with wiki metadata fetched concurrently; pet skills the API rejects are authored in the
generator and never requested. Its pet output consumes the ID generator's key map. Each complete refresh prepares,
validates, and formats every output before writing, so API, generation, or formatting failures leave the previous files
intact. Successful publication reports counts and target paths. Filesystem write failures are reported to the caller;
publication is not a multi-file filesystem transaction.

Committed `ids.ts` bindings load as TypeScript source and anchor key ownership across API reordering and name changes,
including blank names. Missing expected exports fail explicitly. New same-name records allocate keys by numeric ID,
independently of input order. Ranger's authored player and pet key names live in the generator source. Authored fixed
identities keep supported synthetic actions, procs, and variants that the API omits. Unexpected missing bindings,
retargeted keys, and collisions fail with the affected map name before publication. An intentional identity removal
requires updating its consumers and committed declaration together. `npm run generate:engineer-ids` and
`npm run generate:revenant-ids` regenerate only IDs from committed source metadata and need no compilation step.

## Validation

Use focused Node tests for engine, profession, and data changes. Run `npm run build:modules` first, then
`node --test <test-files>`. `npm run check` runs formatting, lint, build, Node tests, type checking, and artifact checks
without launching browsers. Generator tests
(`node --test tests/scripts/generator*.test.mjs tests/scripts/generated-identity-preservation.test.mjs tests/scripts/profession-data-refresh.test.mjs`)
load source fixtures and prepared TypeScript directly, so they require no build and cannot resolve IDs through stale
`dist` output.

For browser behavior changes, select the affected files with `npm run test:browser -- tests/browser/<name>.spec.js`.
Browser tests should protect interactions, focus, layout, and browser integration; numerical and profession matrices
belong in Node. Use `npm run check:all` for explicit full integration/release validation. CI continues to run the full
browser suite.

## Formatting touched files

Format only files changed by the current task. From the repository root, pass their explicit paths:

```sh
npx prettier --write --ignore-path .gitignore <touched-files>
npx prettier --check --ignore-path .gitignore <touched-files>
```

Replace `<touched-files>` with a space-separated list of supported files, including Markdown. This overrides
`.prettierignore`'s documentation exclusions while retaining Git's generated/local-file ignores. `npm run format:check`
retains its existing scope; it does not replace the explicit touched-document check. Avoid a repository-wide formatting
pass when making a local change. Prettier does not support `.gitignore` or `.prettierignore`.

## Local scratch work

Keep disposable scripts, downloaded analysis inputs, and captured logs under the root `.scratch/` directory (create it
when needed). Git, ESLint, and Prettier ignore it. Review existing files before moving or deleting them; preserve
anything whose purpose or ownership is unclear.

Repeatable tools belong in `scripts/analysis/`, where ESLint supplies the Node environment. Give them descriptive names,
use explicit input paths, and document their invocation below. Check relative imports and default paths when promoting a
scratch script. `.lavish/` remains tool-managed review output, separate from manually created scratch work.

## Analysis tools

- Regenerate the four in-app GIF walkthroughs with `node scripts/analysis/capture-tutorials.mjs` while
  `npm run dev -- --host 127.0.0.1 --port 4173` is running. Requires Chrome and Python with Pillow
  (`python -m pip install Pillow`). Set `TUTORIAL_URL` to use another local server or `PYTHON` to use another Python
  executable. Captures use real UI interactions and validate template loading, optimizer completion and GIF decoding.
  Numbered PNG frames and their timing manifest stay in `.scratch/tutorial-capture/` for visual review; the four GIFs
  replace `images/tutorials/` assets.

- `npm run build:modules && node scripts/analysis/capture-supported-build-metrics.mjs [profession...]` prints current
  deterministic preset metrics as JSON.
- `npm run build:modules && node scripts/analysis/benchmark-gear-optimizer.mjs [profession...]` measures optimizer
  setup, candidate preparation, simulation, serialization, and a small grouped search using the first rotation-backed
  preset for each profession. Defaults to Elementalist, Mesmer, Necromancer, Ranger, and Revenant. JSON output includes
  timings, memory/GC measurements, simulation warnings, and Git revision/working-tree state. For CPU or heap profiles,
  add Node's `--cpu-prof` or `--heap-prof` before the script path and direct output to `.scratch/` with
  `--cpu-prof-dir=.scratch` or `--heap-prof-dir=.scratch`.
- `npm run build:modules && node scripts/analysis/benchmark-gear-optimizer-space.mjs` measures search-space grouping
  without simulating candidates. It compares two- and three-prefix Warrior spaces and an Elementalist Scepter/Dagger
  space with equipment and infusion choices. JSON lines report assignment counts and preparation time; hitting the
  preparation memory limit in the Warrior cases is reported as `preparationStopped`.
- `node scripts/analysis/benchmark-gear-optimizer-browser.mjs [profession...]` measures real browser optimizer pools
  with one, two, and four workers, checks consistent winners and search coverage, and measures cancellation. Requires
  Chrome and a free local port 4179; it starts and stops its own Vite server. Defaults to Elementalist, Necromancer, and
  Ranger, using their first rotation-backed presets. Three runs per worker count produce median timing, frame-gap, and
  memory measurements as JSON; progress goes to stderr. This benchmark can take several minutes.
- `npm run build:modules && node scripts/analysis/measure-engine-ownership.mjs` compares detailed, score-only, and
  available isolated-skill execution timings across fixed Warrior, Guardian, Engineer, and Mesmer mechanic scenarios. It
  validates each scenario before timing and prints total and engine-phase measurements as JSON. It accepts no arguments
  and uses ten warmups followed by nine samples of twenty runs per mode.
- `npm run build:modules && node scripts/analysis/analyze-evtc.mjs <fight.evtc|fight.evtc.zip|fight.zevtc>` inspects a
  local ArcDPS log. Add `--summary` or the documented `--debug-*` filters to narrow the output.
- `npm run build:modules && node scripts/analysis/reconstruct-evtc-rotation.mjs <fight.evtc|fight.evtc.zip|fight.zevtc>`
  reconstructs simulator commands from a local ArcDPS log.
- `npm run build:modules && node scripts/analysis/reconstruct-dps-report-rotation.mjs <dps.report URL>` reconstructs
  simulator commands from public Elite Insights JSON. Add `--build=<build.json>` when polymorphic skill choices must
  match a saved build.
- `npm run build:modules && node scripts/analysis/analyze-overload-fire.mjs <fight.zevtc> [--json]` counts Burning Bolt
  missile creations during each Tempest's recorded Overload Fire casts. Also accepts `.evtc` and single-entry
  `.evtc.zip` revision 1 logs. Counts represent projectiles, not whirl pulses or confirmed hits. Missing projectile data
  and incomplete casts produce warnings; JSON separately reports bolts outside recorded casts. A missing stop is bounded
  by the next animation or log end.
- `node scripts/analysis/analyze-dps-report.mjs <report.html|dps.report URL>` inspects Elite Insights data embedded in a
  saved or remote report. Add `--summary`, `--player=<index|name|account>`, or `--phase=<index|name>` to narrow the
  output.

## Benchmark metrics

`npm run benchmarks:compare` simulates rotation-backed manifest presets and reports total DPS drift beyond 1%. Use
`-- --absolute-dps` for a diagnostic 100 DPS tolerance, or `-- --commit` to write `benchmarkDps` (whole DPS),
`benchmarkApm` (one decimal), and `benchmarkDpsByHealth`. Entries without rotations retain their live metrics. Warnings
identify the emitting preset and patch in console output and are not stored in manifests.

Target-health bands (`100-80`, `80-60`, `60-40`, `40-20`, `20-0`) store whole-player-DPS `{ cumulative, phase }`:

- Cumulative DPS runs from combat start to the band's ending health; phase DPS uses only that band's damage and
  duration.
- Environment damage advances target health but does not count toward player DPS.
- Unreached endpoints and zero-duration phases are `null`. If the target survives, both `20-0` values use final overall
  DPS, even when 20% was not reached.
- APM uses non-autoattack inputs over the execution window, excluding precasts before an explicit combat boundary.

An active patch preview simulates the same builds and stores `patchPreview` with `patchId`, `benchmarkDps`, and
`benchmarkDpsByHealth`; APM remains shared with live. `pendingBenchmarks` identifies builds awaiting reworks. Rerun with
`--commit` after preview edits. With no active preview, committing removes `patchPreview` from every entry, including
those without rotations. Dry runs report pending changes without writing files.

Patch-preview commands are documented in [Patch preview](../docs/architecture/PATCH-PREVIEW.md).
