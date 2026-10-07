# General integration and bug audit

Baseline: `061147ad40b62f032fb2f0da41f2dd4d9807eee3` (2026-10-07).

Status: Initial investigation complete. This report owns cross-cutting integration defects; it does not claim exhaustive
coverage or absence of bugs.

## Scope and methods

Risk-based coverage: build/rotation persistence and import/export, workspace restoration and switching, worker
cancellation and stale results, caches and repeated operations, malformed input, error recovery, packaging and
displayed/calculated consistency. UI layout and individual profession mechanics have separate primary auditors.

Read the repository README, architecture/module ownership and platform ownership documentation, scripts/test
contribution conventions, and supplied issue inventory. The coordinator reports baseline `npm run check` passed (4,876
Node tests); this agent has not rerun that broad check. Focused probes and their actual results are recorded below. No
source, production test, dependency, or configuration files were changed.

### Actual coverage inventory

| Area                                      | Source and exercised behavior                                                                                                                                              | Result / limit                                                                                                                                                                                                                                                                                     |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Persistence and workspace                 | `build/state/{persistence,workspace}.ts`, `build/library/{storage,actions,assets,controller,state,model}.ts`; build codec and Mesmer selected-name migration               | Traced migration, wrong-profession/future-schema handling, reset targets, tab capture, transactional My Builds writes, async destination validation, and selection caching. Focused existing tests covered all nine profession migration boundaries. BUG-001 is the cross-tab shared-settings gap. |
| Import/export                             | `import-export/{files,build-file-import,build-file-import-dialog,rotation-import-dialog,import-dialog}.ts`, log adapter entry points, `session-controls.ts`                | Read preview/application/destination/cancellation paths; executed actual JSON preview and engine comparison (BUG-002). Export payload cloning and download lifecycle inspected only, not actual browser downloads.                                                                                 |
| Async calculations                        | `simulation/{baseline,random-distribution,modifier-contributions,skill-damage}/runner.ts`, `browser/game/worker-harness.ts`, optimizer gear/relic runners                  | Traced request IDs, revision admission, cancellation, fallback, construction failures, and outgoing-tab cleanup. Relevant existing fixture tests passed. No general stale-worker publication defect found in inspected paths; does not prove all races absent.                                     |
| Editing and shared state                  | `profession-app.ts`, `rotation/{context,comparison-state}.ts`, editing actions/history/operations, palette model/interactions, hotkey dispatch, timeline interaction guard | Checked independent tab history, cached results, pending baseline authoring, comparison identity, and repeated mutations. Executed stale palette context/macro probe (BUG-003).                                                                                                                    |
| Calculation/config boundaries             | `create-runtime.ts`, `simulation/build-config.ts`, `simulation/settings.ts`, settings panel, selected codec and transition-lockout owner                                   | Compared fresh simulation requests with cached results and checked settings stay outside build exports. No external game-mechanic assumptions are needed for findings.                                                                                                                             |
| Packaging, startup, embed, log boundaries | `vite.config.js`, Pages/release workflows, `browser/{bootstrap,entry}.ts`, registry and embed owner, log URL builders, EVTC decompression limits                           | Source inspection only; existing coordinator build/check evidence used. No build was rerun, deployed, or changed. External host/CORS/compression-browser behavior remains unverified.                                                                                                              |

Commands and actual results:

- `node --test tests/games/gw2/app/build-workspace.test.js tests/games/gw2/app/simulation-settings.test.js tests/games/gw2/app/simulation-runners.test.js tests/games/gw2/app/skill-damage-runner.test.js tests/games/gw2/app/palette-activation.test.js tests/browser/worker-harness.test.js`
  — **49 passed, 0 failed, 0 skipped**. These existing tests verify guards around the failures but do not cover the
  reported cross-feature cases.
- Three focused scratch probes used existing compiled modules through package aliases: `settings-cache-probe.mjs`,
  `import-probe.mjs`, `palette-race-probe.mjs`. All final executions completed successfully and produced the
  observations quoted in BUG-001–003. The report embeds runnable reproductions so evidence does not depend on
  uncommitted scratch files.
- `rg` source/caller/test searches and numbered source reads checked the paths and references below. Relevant
  architecture, module, platform ownership, Mesmer/Revenant, and EVTC reconstruction documents were read. Issue states
  were checked against the supplied recent records rather than inferred from original issue bodies.
- `npx prettier --write --ignore-path .gitignore docs/audits/2026-10-07/05-general-bugs.md` formatted only this report.
  The repository-wide baseline remained the coordinator's responsibility.

## Findings

### BUG-001 — Shared transition-delay changes reuse stale results in other build tabs

- **Classification:** bug. **Severity:** medium. **Confidence:** high (executed source-level integration reproduction).
- **Baseline locations:** `js/games/gw2/app/build/panels/simulation-settings.ts:19–24` (`update`);
  `js/games/gw2/app/profession-app.ts:234–250` (`prepareSimulationState`) and `:378–400` (`activateBuildTab`);
  `js/games/gw2/app/build/state/workspace.ts:142–152` (`captureActiveBuildTab`).
- **Expected:** Transition delays are explicitly shared across builds; returning to a previously simulated tab must
  recalculate results with the current settings. A pinned reference must also use the same settings.
- **Observed:** Changing a setting calls `app.changed()` for the active tab only. Inactive tabs retain
  `resultsFresh = true`. Activation checks the diagnostics flag but no simulation-settings identity/version, adopts the
  cached results, stamps their revision as current, and skips the baseline job.
- **Trigger / impact:** Simulate tab A, switch to B, change a Transition delay, return to A. A displays old
  timing/planning/results as current alongside new settings. The error persists until an edit reruns A; chart enrichment
  can additionally mix newly calculated charts with old baseline facts. No reload or malformed data is required.
- **Reproduction:** A focused Node fixture used the real `ProfessionApp.prototype.activateBuildTab`, `addBuildTab`,
  Mesmer adapter, and calculation engine; worker scheduling and storage were stubbed, DOM rendering omitted. A default
  Mesmer rotation of Combat Start, Swap Weapons (−3), Psycut (73154) was calculated with zero delay, cached while B was
  activated, then `app.simulationSettings.transitionDelays.weaponSwapMs = 1000; app.changed()` was applied in B.
  Returning to A produced `cachedObjectReused: true`, `baselineJobsAdded: 0`, `simulationStatus: "idle"`, and equal
  build/result revisions. The cached rotation end was **0.4 s** with no transition event; direct recomputation under the
  now-current settings ended at **1.4 s** with a 1 s `gw2.transition-lockout`. These are fixture results, not
  performance benchmarks. The settings callback and absence of cross-tab invalidation were verified in source; a real
  browser could not be run.
- **Runnable probe:** Save the following as `.scratch/audit/bugs/settings-cache-probe.mjs` and run
  `node .scratch/audit/bugs/settings-cache-probe.mjs` from the repository root against existing compiled modules. Its
  `changed` stub models the settings callback's active-tab revision/storage effects; source tracing above establishes
  that real `changed()` does not invalidate inactive tabs. The real activation and calculations are used.

```js
import { ProfessionApp } from '#gw2/app/profession-app.js';
import { mesmerAppAdapter as adapter } from '#gw2/professions/mesmer/app/app-definition.js';
import {
  addBuildTab,
  createBuildTab,
  emptyBuildTabSession,
  saveBuildWorkspace
} from '#gw2/app/build/state/workspace.js';
import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
globalThis.localStorage = { getItem: () => null, setItem() {} };
const build = adapter.toApplicationBuild(adapter.profession.createBuildDefaults());
const skill = adapter.profession.catalog.skillsByName.get('Swap Weapons');
build.rotation = [{ type: 'combat-start' }, { type: 'cast', skillId: skill.id }, { type: 'cast', skillId: 73154 }];
const tab = createBuildTab(build, 'A');
const scheduled = [];
const app = Object.assign(Object.create(ProfessionApp.prototype), emptyBuildTabSession(), {
  adapter,
  profession: adapter.profession,
  activeCatalog: adapter.profession.catalog,
  skillById: adapter.profession.catalog.skillsById,
  workspace: { tabs: [tab], activeTabId: tab.id },
  build,
  patchId: 'current',
  buildRevision: 1,
  resultRevision: 1,
  simulationStatus: 'idle',
  initialRenderGeneration: 0,
  simulationSettings: { transitionDelays: normalizeTransitionDelays(null) },
  baselineSimulationRunner: {
    ensureCharts() {},
    cancel() {},
    schedule(revision) {
      scheduled.push(revision);
    }
  },
  randomDistributionRunner: { cancel() {}, schedule() {} },
  modifierContributionRunner: { cancel() {}, schedule() {} },
  relicComparisonRunner: { cancel() {}, schedule() {} },
  changed() {
    this.buildRevision++;
    this.simulationStatus = 'queued';
    saveBuildWorkspace(this);
  }
});
adapter.recalculate(app);
app.results = adapter.calculateBaselineSimulation(adapter.baselineSimulationRequest(app)).result;
const cached = app.results;
addBuildTab(app, structuredClone(build), 'B');
// The settings control performs these two operations (normalization/persistence do not invalidate other tabs).
app.simulationSettings.transitionDelays.weaponSwapMs = 1000;
app.changed();
const count = scheduled.length;
app.activateBuildTab(tab.id);
const fresh = adapter.calculateBaselineSimulation(adapter.baselineSimulationRequest(app)).result;
console.log(
  JSON.stringify(
    {
      cachedObjectReused: app.results === cached,
      baselineJobsAdded: scheduled.length - count,
      status: app.simulationStatus,
      revisionMatches: app.resultRevision === app.buildRevision,
      settingsMs: app.simulationSettings.transitionDelays.weaponSwapMs,
      cachedDps: app.results.dps,
      recomputedDps: fresh.dps,
      cachedEnd: app.results.rotationEndTime,
      recomputedEnd: fresh.rotationEndTime,
      cachedDelay: app.results.events.filter((e) => e.type === 'gw2.transition-lockout'),
      recomputedDelay: fresh.events.filter((e) => e.type === 'gw2.transition-lockout')
    },
    null,
    2
  )
);
```

- **Smallest fix:** On shared simulation-setting changes, invalidate every workspace tab's cached results and queue its
  nonempty pinned reference; let inactive tabs recalculate lazily when activated. Alternatively store and compare a
  normalized settings signature alongside cached output. Do not invalidate all tabs for ordinary build-local edits.
- **Regression risk / validation:** Preserve fast reuse for unchanged settings and build-local edits. Add a focused
  two-tab test changing each transition control and a bulk action, returning to A, and checking that both Current and a
  populated Reference match direct recomputation. Include the case where settings change back before reactivation.
- **Related:** No matching issue identified in the supplied recent issue/PR inventory; independent of known open
  #66/#70. Existing `tests/games/gw2/app/build-workspace.test.js` covers diagnostics-mode invalidation but not shared
  transition settings.

### BUG-002 — Rotation-file import resolves specialization-dependent skill names against the wrong catalog

- **Classification:** bug. **Severity:** medium. **Confidence:** high (actual importer and engine reproduction).
- **Baseline locations:** `js/games/gw2/app/import-export/rotation-import-dialog.ts:57–69` (`previewRotationFile`),
  `:130–137` (`previewManifestRotation`), and `:216–219` (`applyRotationImportPreview`);
  `js/games/gw2/professions/mesmer/build/build.ts:77–89` (`normalizeExtra`);
  `js/games/gw2/app/build/state/persistence.ts:105–117` (`replaceBuildRotation`).
- **Expected:** A supported legacy JSON rotation naming Bladecall must resolve to the variant for the selected
  specialization, consistently with build imports and saved workspace restoration. Explicit numeric IDs must keep their
  existing meaning.
- **Observed:** Load rotation normalizes names immediately with the profession-wide `app.activeCatalog` and then assigns
  those commands directly. The selected-specialization codec deliberately corrects this ambiguity, but that codec is
  bypassed; after conversion, the name is gone and later persistence treats the wrong ID as explicit.
- **Trigger / impact:** On the default Virtuoso build (Dagger/Sword), import `{"rotation":["Bladecall"]}` through Load
  rotation. It becomes skill **62560**, produces **0** damage, and warns
  `Bladecall: Bladecall is unavailable — its required weapon is not equipped.` Loading the same JSON through Import
  build (rotation only) yields skill **69311**, **3811** damage, and no warnings. Legacy name-based rotations are
  advertised as supported in the importer. Current numeric-ID exports are not affected.
- **Reproduction:** Run from the repository root after modules exist; the only browser shim below supplies file reading.
  This exercises real preview/application/configuration/engine functions:

```js
import { mesmerAppAdapter as adapter } from '#gw2/professions/mesmer/app/app-definition.js';
import { previewRotationFile, applyRotationImportPreview } from '#gw2/app/import-export/rotation-import-dialog.js';
import { previewBuildFileImport, applyBuildFileImport } from '#gw2/app/import-export/build-file-import.js';
globalThis.FileReader = class {
  async readAsText(file) {
    this.result = await file.text();
    this.onload();
  }
};
const app = {
  adapter,
  profession: adapter.profession,
  activeCatalog: adapter.profession.catalog,
  skillById: adapter.profession.catalog.skillsById,
  build: adapter.toApplicationBuild(adapter.profession.createBuildDefaults()),
  patchId: 'current',
  attributeWeaponSet: 1,
  changed() {}
};
adapter.recalculate(app);
const payload = { rotation: ['Bladecall'] };
applyRotationImportPreview(app, await previewRotationFile(new File([JSON.stringify(payload)], 'legacy.json'), app));
const first = adapter.calculateBaselineSimulation(adapter.baselineSimulationRequest(app)).result;
console.log(app.build.rotation, first.totalDamage, first.warnings);
applyBuildFileImport(app, previewBuildFileImport(payload, 'legacy.json', app), { build: false, rotation: true });
const second = adapter.calculateBaselineSimulation(adapter.baselineSimulationRequest(app)).result;
console.log(app.build.rotation, second.totalDamage, second.warnings);
```

- **Smallest fix:** Route JSON and manifest rotation previews through the selected profession's build-rotation codec
  before discarding authored names, while preserving strict rejection of malformed command fields. A generic
  normalization pass first cannot fix this: it already destroys the specialization-dependent name. Keep the destination
  guard and explicit-ID precedence.
- **Regression risk / validation:** Verify Virtuoso Bladecall, Mirage Axes of Symmetry/Lingering Thoughts, Core
  variants, and Troubadour duplicate instrument names in both Current and Reference imports. Retain strict
  malformed-command tests and explicit-ID tests. The manifest path has the same source issue; this audit reproduced an
  uploaded JSON file, not every shipped preset.
- **Related:** No matching issue identified in the supplied recent inventory. Existing Mesmer build-codec tests
  explicitly protect the correct selected lookup, but the separate rotation-dialog integration bypasses it.

### BUG-003 — A palette action queued after a weapon swap uses the previous weapon state

- **Classification:** bug. **Severity:** medium. **Confidence:** high for the deterministic integration behavior;
  browser gesture timing was not exercised.
- **Baseline locations:** `js/games/gw2/app/profession-app.ts:204–229` (`changed`, deferred rotation rendering);
  `js/games/gw2/app/rotation/context.ts:33–53` (`palettePlanningState`);
  `js/games/gw2/app/rotation/palette/interactions.ts:69–75` (click binding) and `:181–203`
  (`dispatchPaletteActivation`); `js/games/gw2/app/rotation/palette/model.ts:546–555` (`currentAutoattackSkill`) and
  `:663–676` (`createPaletteContext`);
  `js/games/gw2/professions/revenant/specializations/vindicator/presentation.ts:50–64`
  (`vindicatorDodgeAutoRotationEntries`).
- **Expected:** Dodge + Auto appends the autoattack for the weapon set at its insertion position. If the preceding edit
  is still being simulated, state-dependent authoring must wait, queue intent, or derive the current prefix before
  resolving that intent.
- **Observed:** Rotation edits retain old results and old palette DOM while waiting for the worker. Palette activation
  has no revision check, and `palettePlanningState()` returns the old tail state whenever the insertion cursor is at the
  current rotation's tail, even when `resultRevision !== buildRevision`. A second action can therefore resolve a macro
  using the weapon set before the first action. The timeline has a revision guard for indexed gestures; it does not
  protect palette clicks.
- **Trigger / impact:** Load the shipped Power Vindicator Greatsword Energy build, which starts on Greatsword set 2.
  Click Swap Weapons, then Dodge + Auto before the new baseline publishes. The resulting commands are Swap Weapons (−3),
  Dodge Jump (23275), **Mist Swing (62913)**. The correct post-swap weapon set is Sword set 1, whose autoattack is
  **Preparation Thrust**. Simulation rejects the appended Mist Swing with
  `Mist Swing: Mist Swing is unavailable — its required weapon is not equipped.` The wrong command is saved in the
  rotation and remains wrong after calculation completes. This is an authoring race, not a Revenant damage-mechanic
  disagreement.
- **Reproduction:** The following focused probe invokes the real palette dispatcher, action insertion, palette
  projection, adapter, and engine. The `changed` stub intentionally holds the queued interval, matching the production
  deferred render branch; no timers or engine responses are allowed to complete between the two actions. Production's
  baseline runner debounces 40 ms (`simulation/baseline/runner.ts:18,71–75`) and then waits for the worker, so this is a
  reachable pending state. Save under `.scratch/audit/bugs/palette-race-probe.mjs` and run with Node from the repository
  root. Actual output showed `before: {set:2,auto:"Mist Swing"}`, the same stale context after Swap Weapons,
  `fresh: {set:1,auto:"Preparation Thrust"}`, and the warning above.

```js
import fs from 'node:fs';
import { revenantAppAdapter as adapter } from '#gw2/professions/revenant/app/app-definition.js';
import { dispatchPaletteActivation } from '#gw2/app/rotation/palette/interactions.js';
import { addRotation } from '#gw2/app/rotation/editing/actions.js';
import { createPaletteContext } from '#gw2/app/rotation/palette/model.js';
const build = adapter.toApplicationBuild(
  JSON.parse(fs.readFileSync('data/gw2/builds/revenant/b-power-vindicator-greatsword-energy.json', 'utf8'))
);
build.rotation = [];
const app = {
  adapter,
  profession: adapter.profession,
  activeCatalog: adapter.profession.catalog,
  skills: [...adapter.profession.catalog.skills],
  skillById: adapter.profession.catalog.skillsById,
  skillByName: adapter.profession.catalog.skillsByName,
  weaponData: adapter.weaponData,
  build,
  patchId: 'current',
  attributeWeaponSet: 1,
  buildRevision: 1,
  resultRevision: 1,
  simulationStatus: 'idle',
  rotationInsertionIndex: null,
  changed() {
    this.buildRevision++;
    this.simulationStatus = 'queued';
  },
  addRotation(name, options) {
    addRotation(this, name, options);
  }
};
adapter.recalculate(app);
app.results = adapter.calculateBaselineSimulation(adapter.baselineSimulationRequest(app)).result;
const before = createPaletteContext(app);
addRotation(app, 'Swap Weapons');
const stale = createPaletteContext(app);
const swapped = adapter.calculateBaselineSimulation(adapter.baselineSimulationRequest(app)).result;
const fresh = createPaletteContext({
  ...app,
  results: swapped,
  resultRevision: app.buildRevision,
  simulationStatus: 'idle'
});
dispatchPaletteActivation(app, '__vindicator_dodge_auto', {
  currentTarget: { dataset: {} },
  shiftKey: false,
  ctrlKey: false
});
const result = adapter.calculateBaselineSimulation(adapter.baselineSimulationRequest(app)).result;
console.log(
  JSON.stringify(
    {
      before: { set: before.activeWeaponSet, auto: before.activeAutoattack.name },
      stale: { set: stale.activeWeaponSet, auto: stale.activeAutoattack.name },
      fresh: { set: fresh.activeWeaponSet, auto: fresh.activeAutoattack.name },
      rotation: app.build.rotation,
      warnings: result.warnings
    },
    null,
    2
  )
);
```

- **Smallest fix:** Guard state-dependent palette activation and hotkey dispatch against pending revisions, or defer
  unresolved user intent until the current planning result is available. Keep harmless static command insertion
  available if desired, but never resolve a macro from a stale tail state. If planning state is recomputed synchronously
  instead, include build revision in any palette cache and assess long-rotation responsiveness.
- **Regression risk / validation:** A focused delayed-worker test should append Swap Weapons and immediately trigger
  Dodge + Auto; verify the action is deferred/rejected clearly or selects the new autoattack. Cover flipped bars and
  active autoattack-chain progression, repeated hotkeys, insertion at an armed cursor, and release of the pending guard
  after success/failure. Do not solve this by accepting an unavailable skill in the engine.
- **Related:** No matching issue identified in the supplied recent inventory. Separate from BUG-001 (cache lifetime
  across tabs); both require explicit freshness at an application boundary. The focused palette-activation tests passed
  but do not exercise a retained prior baseline.

## Refactoring recommendations

No independent structural refactor is necessary for these findings. Prefer extending existing workspace freshness,
profession codec, and palette-planning contracts as described above. The existing shared worker batch already
centralizes stale-message rejection and cleanup; this review found no justification for replacing feature-specific
scheduling with a new general runner.

## Open questions and coverage gaps

- **Confirmed environment gap:** No functional Chrome/Chromium browser was available. The coordinator's Chrome install
  failed on package-manager privileges and Chromium download attempts produced invalid/truncated archives. No
  real-browser, iframe, responsive-layout, download, focus, or actual Worker execution is claimed here. Source
  inspection and controlled Node fixtures establish the three reported logic failures.
- External dps.report/gw2wingman endpoint behavior, CORS, fresh real combat logs, network timeouts, and host
  integrations were not executed. URL builders and parser/decompression entry validation were inspected; no
  source-proven defect was promoted merely because external availability was unknown.
- Long-running memory/CPU behavior, tab suspension/resumption, simultaneous writes from multiple browser tabs, storage
  eviction, and OS/browser-specific download timing were not stress-tested. Workspace localStorage writes are separate
  from the explicitly merged My Builds library.
- Profession numerical fidelity, scheduler/resource invariants, and CSS/accessibility have separate primary auditors. No
  exhaustive malformed-input or profession matrix is claimed. The BUG-003 reproduction covers the Vindicator macro;
  wider dynamic-bar/hotkey effects are regression-test targets, not separately verified failures.
- Historical issue coverage is limited to the supplied 36 issue bodies and 100 recent issue/PR records. #66 and #70
  remain open in that inventory; closed reports were not treated as current defects without baseline evidence.
