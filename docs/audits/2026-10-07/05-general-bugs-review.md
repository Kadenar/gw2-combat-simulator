# Independent review of general integration findings

Baseline: `061147ad40b62f032fb2f0da41f2dd4d9807eee3`.

Review complete. [Original report](./05-general-bugs.md) preserved unchanged; its SHA-256 remains
`8e2434f8ef713066002ce171577482a92e7aa8bae89000034b28de450820afca`, matching the freeze record.

## Disposition table

| Original ID | Disposition                | Final classification | Final severity | Confidence                                                                   | Decision                                                                                                                                                                                                                                                                  |
| ----------- | -------------------------- | -------------------- | -------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BUG-001     | confirmed                  | bug                  | medium         | high                                                                         | Real settings callbacks leave inactive Current and Reference caches reusable under changed shared settings.                                                                                                                                                               |
| BUG-002     | confirmed                  | bug                  | medium         | high                                                                         | Legacy names resolve incorrectly in the rotation dialog; selected-specialization build normalization resolves them correctly. Explicit IDs remain intentionally unchanged.                                                                                                |
| BUG-003     | confirmed with corrections | bug                  | medium         | high for reproduced logic and DOM-event path; actual browser timing untested | The original Dodge + Auto click is blocked by existing palette disablement. The same stale authoring problem is publicly reachable through Weapon swap followed by Weapon skill 1 hotkeys. Replace the advertised reproduction and strengthen the proposed freshness fix. |

No original finding is rejected or unresolved. BUG-003's specific macro-click reachability claim is rejected, while its
underlying stale palette/hotkey defect is independently reproduced. Reviewer discovery BUG-R001 is separately recorded
below and was independently validated by the coordinator after this review raised it.

## Methods and actual coverage

Read the shared agent brief, original report, repository README, architecture/module ownership documents, platform
README, and scripts/tests conventions. Independently traced the cited source, immediate callers, cache admission,
reference requests, codec identity precedence, rendered palette classes, bound handlers, hotkeys, and timeline guards.
All source references below are full repository-relative paths at the stated baseline.

| Area                           | Executed evidence                                                                                                                                                                                                                                                                           | Limit                                                                                                                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Settings/workspace             | Mounted numeric and bulk controls on inert DOM objects; invoked their real callbacks, real `ProfessionApp.changed`, actual baseline runner scheduling, real tab activation, real engine, and pinned references. Compared change/revert/local-edit cases and restored workspace cache state. | Build-section rendering and background comparison runners were inert. No actual browser storage or Worker was exercised.                                                                                     |
| Rotation import                | Actual file reader boundary with a FileReader shim, strict preview, application, selected build codec, and real engine. Checked Virtuoso, Mirage, Core, explicit IDs, and malformed fields.                                                                                                 | Uploaded JSON path executed. Manifest/Reference UI paths inspected, not clicked in a browser.                                                                                                                |
| Palette/hotkeys                | Actual palette HTML generation, parsed into a small DOM fixture retaining real class/identity attributes; actual palette binding and document hotkey listeners; real application change handling and baseline scheduling. Compared consecutive keys with a settled/rendered control case.   | DOM fixture is not a browser. It establishes event-handler reachability, not measured human gesture timing, focus behavior, or rendering performance.                                                        |
| Original broad coverage claims | Reviewed relevant caller protections and existing tests.                                                                                                                                                                                                                                    | Packaging, worker fallback/error combinations, all imports, network services, and all profession mechanics were not independently re-audited. The original inventory must remain risk-based, not exhaustive. |

Commands and final results, run from the repository root using existing compiled modules:

```sh
node .scratch/audit/review-bugs/independent-probes.mjs
node .scratch/audit/review-bugs/dom-hotkey-probe.mjs
node .scratch/audit/review-bugs/reproduce-public-palette.mjs
node --test tests/games/gw2/app/build-workspace.test.js tests/games/gw2/app/simulation-settings.test.js tests/games/gw2/app/rotation-comparison.test.js tests/games/gw2/app/palette-activation.test.js tests/games/gw2/app/rotation-hotkeys.test.js tests/games/gw2/professions/mesmer/build-codec.test.js
sha256sum docs/audits/2026-10-07/05-general-bugs.md
```

Both final investigation probes and the standalone appendix probe exited successfully and asserted the observations
below. The appendix was extracted from the formatted report and executed successfully. Only this review was formatted
with `npx prettier --write --ignore-path .gitignore docs/audits/2026-10-07/05-general-bugs-review.md`; the corresponding
`--check` passed. The existing tests passed **56/56**, with zero failures, cancellations, or skips. These tests
establish neighboring contracts; their success does not cover the reported combinations. During probe development, a new
assertion that the real macro tile was enabled failed; that failure led to the material BUG-003 correction and BUG-R001.
Early incomplete DOM shims were corrected before the final runs. No browser installation was retried. The coordinator's
successful `npm run check` with 4,876 tests was not repeated; no source, production tests, configuration, dependencies,
or Git state were changed.

## Finding reviews

### BUG-001 — Shared transition settings invalidate only the active tab

**Disposition:** confirmed. **Classification:** bug. **Severity:** medium. **Confidence:** high.

The expected behavior is established directly by the controls' “Shared across builds” description, and by including
transition delays in simulation inputs. This is not merely a preference affecting presentation.

Baseline source chain:

- `js/games/gw2/app/build/panels/simulation-settings.ts:19–24,58–64,71–85`, `mountSimulationSettings`: both input
  changes and bulk actions persist normalized settings and call `app.changed()`.
- `js/games/gw2/app/profession-app.ts:204–214,234–253`, `changed` / `prepareSimulationState`: advance the active
  revision, queue its reference and baseline, and capture its workspace session. No inactive-tab invalidation occurs.
- `js/games/gw2/app/build/state/workspace.ts:142–152`, `captureActiveBuildTab`: the outgoing tab retains a fresh cache
  when its revisions match and its status is idle. `saveBuildWorkspace` at `:155–176` captures only the active tab's
  live session; persisted builds do not include result caches.
- `js/games/gw2/app/profession-app.ts:378–400`, `activateBuildTab`: only diagnostics capture is checked against the
  cached result; a fresh tab gets the current global revision and avoids a full baseline.
- `js/games/gw2/app/rotation/comparison-state.ts:98–103`, `queueRotationReference`, and
  `js/games/gw2/app/create-runtime.ts:291–305`, `baselineSimulationRequest`: only a queued reference is included in the
  next request. Inactive references retaining `fresh` do not repair themselves on activation.

The independent fixture used actual controls, `changed`, the baseline runner, and tab activation, replacing the original
probe's `changed` stub. A and B both had a completed Current and populated fresh Reference. A used Combat Start, Swap
Weapons (-3), Psycut (73154). After changing B, returning to A produced:

| B operation              | Shared weapon delay | A cached end | Direct current-settings end | A baseline queued | B Reference after operation | A Reference on return    |
| ------------------------ | ------------------- | ------------ | --------------------------- | ----------------- | --------------------------- | ------------------------ |
| Numeric input            | 1,000 ms            | 0.4 s        | 1.4 s                       | no                | queued                      | fresh, old object        |
| Apply 100 ms to all      | 100 ms              | 0.4 s        | 0.5 s                       | no                | queued                      | fresh, old object        |
| Input 1,000 then 0       | 0 ms                | 0.4 s        | 0.4 s                       | no                | queued                      | fresh, same valid object |
| Rotation-only local edit | 0 ms                | 0.4 s        | 0.4 s                       | no                | fresh                       | fresh, same valid object |

All four cases reused A's result object and stamped matching revisions. In the first two, A's next request also omitted
`referenceRotation`, confirming that the pinned reference does not independently self-heal. The latter two are useful
counterexamples: cache reuse itself is intentional; unchanged effective settings and unrelated local edits should stay
fast. Reloaded workspaces returned empty, nonfresh caches, so this is an in-memory session problem rather than persisted
corruption. Original probe values and causal explanation hold.

The original chart-mixing warning is supported by source, not directly exercised here:
`js/games/gw2/app/simulation/baseline/runner.ts:78–90` can schedule chart-only work using the new request settings;
`js/games/gw2/app/profession-app.ts:263–277` merges that output into the retained baseline object. It does not recompute
all displayed baseline facts.

**Recommendation and risks:** Keep the original narrow fix: invalidate other workspace tabs on effective shared-setting
changes and queue each nonempty reference in that tab's session. The active tab already follows the normal change path.
Alternatively compare a normalized settings identity with cached results/references at admission. A full recalculation
of every inactive tab is unnecessary; lazy activation avoids multiplying work. A broad change to every `changed()` call
would regress useful local-edit reuse. Signature-based reuse can correctly allow a change followed by a revert; simple
invalidation may conservatively recalculate. Test the controls, bulk actions, Current and Reference, no-op/reverted
settings, and build-local edits together. No engine change is indicated.

### BUG-002 — Selected-specialization lookup is bypassed by rotation preview

**Disposition:** confirmed. **Classification:** bug. **Severity:** medium. **Confidence:** high.

Baseline source chain:

- `js/games/gw2/app/import-export/rotation-import-dialog.ts:57–69,128–144`, `previewRotationFile` /
  `previewManifestRotation`: strict normalization uses the profession-wide `app.activeCatalog`.
- `js/games/gw2/platform/execution/rotation.ts:138–168,171–200`, `decodeRotationCommand` / `normalizeRotationCommand`:
  authored `skillId`/`id` wins over a name; name resolution then produces an ID-only command.
- `js/games/gw2/app/import-export/rotation-import-dialog.ts:216–219,454–466`, `applyRotationImportPreview` / apply
  handler: Current receives canonical commands directly; Reference receives the same preview through
  `app.loadRotationReference`. The destination check protects identity/revision, not specialization resolution.
- `js/games/gw2/professions/mesmer/build/build.ts:77–90`, `normalizeExtra`, and
  `js/games/gw2/professions/mesmer/catalog.ts:28–50`, `getMesmerBuildRotationLookup`: intentionally reread original
  names against Core plus the chosen elite, preserving explicit IDs.
- `js/games/gw2/app/build/state/persistence.ts:96–117`, `replaceBuildRotation`, and
  `js/games/gw2/app/import-export/build-file-import.ts:90–93`, `applyBuildFileImport`: the alternative Import build
  rotation-only path retains raw authored items until this selected-build normalization.

Independent observed cases:

| Current build / input                             | Rotation preview IDs | Selected-build codec IDs | Interpretation                                                                                             |
| ------------------------------------------------- | -------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Virtuoso / `Bladecall`                            | 62560                | 69311                    | Confirmed erroneous name resolution; preview application does 0 damage and warns about unavailable weapon. |
| Mirage / `Axes of Symmetry`, `Lingering Thoughts` | 69385, 69344         | 43761, 45243             | Second selected-specialization mismatch, including with Axe equipped.                                      |
| Core (third trait line Chaos) / `Bladecall`       | 62560                | 62560                    | Correct non-elite name behavior.                                                                           |
| Virtuoso / explicit 62560 plus name `Bladecall`   | 62560                | 62560                    | Correct explicit-ID precedence; do not rewrite it as a fix.                                                |
| Virtuoso / explicit 69311                         | 69311                | 69311                    | Correct path: 3,811 damage, no warnings.                                                                   |

The original comparison's 0 versus 3,811 damage is reproduced. No claim that every legacy rotation or current exported
numeric-ID rotation fails is warranted. The manifest path shares the defective expression, but these results do not
establish that a shipped manifest asset actually uses an affected legacy name. Troubadour remains a useful regression
case, not an additional failure demonstrated by this review.

**Recommendation and risks:** Preserve names until the profession's selected-build lookup has resolved them, using the
existing ownership contract rather than introducing a Mesmer-specific branch in the dialog. Retain strict validation of
authored fields before any lossy migration. In particular, the independent probe found
`{name:'Bladecall', interruptMs:-1}` rejected with `Interrupt duration must be a non-negative number.` and
`{name:'Bladecall', releaseDelayMs:0}` rejected with `only Dragon Slash casts may contain releaseDelayMs.` Passing
either directly through `replaceBuildRotation` silently dropped the entry. Replacing the preview call with that helper
alone would therefore regress the strict dialog boundary. A generic strict pass can validate while discarding its
output; pass the original items to specialization-aware resolution afterward, or provide an explicit strict
selected-lookup operation. Never feed already converted wrong IDs into a second name-resolution pass. Preserve explicit
IDs, accepted command metadata, patch context, destination guards, and both Current/Reference behavior. No justification
for a larger import rewrite appears.

### BUG-003 — Pending weapon-swap hotkeys author the previous weapon's skill

**Disposition:** confirmed with corrections. **Classification:** bug. **Severity:** medium. **Confidence:** high for
source/DOM-event logic; browser timing remains untested.

**Material correction:** The original direct dispatcher reproduction establishes stale macro expansion internally, but
it bypasses a real outer guard. On a completed baseline the actual Dodge + Auto tile has classes
`pal-skill pal-disabled pal-context-disabled`. The bound click checks that class and returns. Thus “click Swap Weapons,
then Dodge + Auto” is not the demonstrated public trigger at this baseline. That separate availability problem is
proposed as BUG-R001 below.

A corrected public trigger uses existing ordinary hotkeys: load the same Power Vindicator Greatsword Energy build with
an empty rotation, activate palette hotkeys, press Weapon swap (`Backquote`), then Weapon skill 1 (`Digit1`) before the
new result renders. The independently generated real palette has an enabled Mist Swing tile for starting Greatsword set
2 and a disabled Sword tile. The real hotkey listener selects the still-enabled old tile. Actual results:

| Event sequence                                     | Authored command IDs           | Engine warnings                                                                |
| -------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------ |
| Backquote then Digit1 in the pending interval      | -3, 62913 (Mist Swing)         | `Mist Swing: Mist Swing is unavailable — its required weapon is not equipped.` |
| Backquote, settle baseline and render, then Digit1 | -3, 29057 (Preparation Thrust) | none                                                                           |

This fixture used actual generated HTML classes/IDs, `bindAppPaletteInteractions`, `mountRotationHotkeys`' document
listeners, real `ProfessionApp.changed`, a real baseline runner, and the engine. It held the synchronous interval before
the runner's 40 ms timer could fire. The wrong explicit command survives recalculation. No worker message was fabricated
and no browser speed/frequency claim follows from the fixture.

Baseline evidence and correction to the original line references:

- `js/games/gw2/app/profession-app.ts:204–229`, `changed`: retains the old palette/timeline on rotation-only edits.
  `js/games/gw2/app/rotation/editing/actions.ts:76–96` inserts commands and invokes this path.
- `js/games/gw2/app/rotation/hotkeys.ts:352–374,692–738`, `currentHotkeyTarget`, `activateRotationHotkey`,
  `mountRotationHotkeys`: selects an old DOM tile by action and context-disabled class; it has no build/result freshness
  input. Holding a key is intentionally blocked by `event.repeat`; distinct rapid key presses are not blocked.
- `js/games/gw2/app/rotation/palette/interactions.ts:69–75,155–173,271–285`, `bindPaletteInteractions`,
  `dispatchPaletteActivation`, `bindAppPaletteInteractions`: class admission is outside the dispatcher. The original
  dispatch citation `:181–203` is inaccurate; those lines concern editors, not profession-action dispatch.
- `js/games/gw2/app/rotation/context.ts:32–51`, `palettePlanningState`: reuses a tail result without checking revisions.
  A mid-rotation or observation-tail case can use a prefix simulation, so not every pending context follows this path.
- `js/games/gw2/app/create-runtime.ts:249–264`, `rotationPlanningStateAt`: independently repeats the stale tail fast
  path. Calling this adapter method is not itself a freshness fix; the probe returned weapon set 2 after an unsimulated
  swap even when called directly.
- `js/games/gw2/app/rotation/palette/model.ts:546–555,663–675`, `currentAutoattackSkill` / `createPaletteContext`:
  explains the original direct-dispatch macro expansion, but cannot override the outer click guard.
- `js/games/gw2/app/rotation/editing/timeline-options.ts:251–264`, `timelineInteractionOptions`: separately blocks
  retained timeline indexed gestures by captured revision. This protection does not extend to palette hotkeys.
- `js/games/gw2/app/simulation/baseline/runner.ts:18,55–75,173–184`: the debounce creates a pending interval and
  existing completion guards reject superseded output. This is an input-authoring problem, not missing stale-worker
  rejection.

**Corrected recommendation and risks:** Gate pending state-dependent hotkeys before selecting a retained DOM tile, or
queue semantic intent such as “weapon slot 1” and resolve it against the freshly rendered/current planning context.
Guarding only profession macro expansion does not fix the demonstrated hotkey path: the old tile already carries an
explicit numeric ID. A blanket palette pending guard is simpler but should give intelligible feedback; silently dropping
fast user input can itself degrade authoring. A synchronous alternative must address both tail fast paths and the
`paletteStateCache` key (currently result identity plus insertion index), not only add a call to the adapter.
Recomputing long prefixes repeatedly on every context read risks main-thread latency; no performance benchmark was
conducted.

Preserve intentional command authoring and valid Dodge + Auto overlap. Its concurrent autoattack is explicitly emitted
by `js/games/gw2/professions/revenant/specializations/vindicator/presentation.ts:50–64,81–86`; removing overlap or
loosening engine weapon eligibility would solve neither freshness nor DOM admission. Regression tests should exercise
actual bound/hotkey paths with delayed publication, old enabled/new disabled tiles, successful fresh reactivation,
simulation failure, and queued intent across tab changes. Wider flips, cursor/cache paths, and chains remain regression
targets, not independently proven additional failures.

## Reviewer discovery independently validated by the coordinator

### BUG-R001 — Dodge + Auto is disabled by missing synthetic availability

**Status:** confirmed after independent coordinator validation; separate from the three original findings.
**Classification:** bug. **Severity:** medium. **Confidence:** high.

Expected: the deliberately exposed Vindicator Dodge + Auto action is activatable when its component actions are valid.
Observed on the real rendered empty-rotation palette for the shipped build: the tile exists but receives
`pal-disabled pal-context-disabled`, with the notice `No runtime availability verdict for this skill.` Invoking its
actual bound click changes the rotation length from 0 to 0. This occurs before any pending edit, so it is independent of
BUG-003's freshness window.

Baseline chain:

- `js/games/gw2/professions/revenant/specializations/vindicator/presentation.ts:20–46,67–86` creates the UI-only string
  ID `__vindicator_dodge_auto`, explicitly described as not a real skill, and provides its command expansion.
- `js/games/gw2/platform/results/planning-state.ts:52–59`, `planningState`, builds availability only from runtime
  catalog skills. The synthetic action has no entry.
- `js/games/gw2/app/rotation/palette/model.ts:321–337,863–881`, `paletteAvailability` / `projectPalette`, denies missing
  verdicts before even consulting a presentation override. `:762–782` carries denial into the tile classes.
- `js/games/gw2/app/rotation/palette/view.ts:37–46,149–174,455–467`, `paletteSkillHtml` / `addGroup` / action-group
  composition, renders those classes; `js/games/gw2/app/rotation/palette/interactions.ts:69–75` prevents the click.

Executed reproduction is preserved below. The coordinator independently inspected these owners, reran the rendered
fixture, and ran a separate harness-free diagnostic for both starting weapon sets. Both component commands had
`ready: true`; the exposed macro still had no verdict and was denied. That validation supports an availability defect
even with no preceding edit. It does not claim browser execution.

Consider an explicit composite-action availability contract using the component dodge/current-auto verdicts, while
keeping unknown ordinary runtime skills denied. Moving a presentation allowance ahead of the missing-verdict check
without restricting it could bypass legitimate gates. Preserve resource, weapon, and insertion-context rules and the
intended concurrent commands. Add a rendered/bound-action integration test; the existing direct Vindicator helper test
does not pass through this renderer admission path. Broader synthetic-action coverage was not surveyed and must not be
inferred from this one case.

## Coverage assessment and remaining gaps

The original report correctly avoids numerical performance claims, external game-mechanic assumptions, and exhaustive
absence claims. Its strongest evidence is at shared application boundaries. Its principal overstatement is BUG-003's
browser-facing macro trigger: internal dispatch success is not public click reachability. The fresh rendered-class check
is therefore necessary even when surrounding existing tests pass.

BUG-001's original simplified `changed` fixture was causally faithful, now strengthened by actual input callbacks and
reference assertions. BUG-002's original real importer probe is faithful, with strict-validation caveats already noted
and now concretely exercised. Source guards preserve several negative cases: local-edit cache reuse, explicit IDs,
normal non-elite name imports, fresh rendered hotkeys, retained timeline index guards, and stale worker completion
rejection. None establishes the absence of other bugs.

Real browser gesture timing, focus, CSS hit testing, actual Workers, all dynamic-bar/armed-cursor cases, every shared
transition field/profession, and every manifest preset remain untested here. External services, downloads, memory/CPU
stress, multi-browser-tab storage contention, and broad issue-history verification remain the original audit's limits.
No independent refactoring recommendation is added: fixes should extend existing freshness, codec, and presentation
contracts, with the source-level exceptions described above.

## Reproduction appendix

The original report preserves runnable BUG-001/BUG-002 probes. Its BUG-003 direct-dispatch probe should be interpreted
only as internal stale-resolution evidence. The following additional standalone probe preserves the crucial independent
public-handler correction and BUG-R001 observation without depending on uncommitted scratch helpers. Save it as
`.scratch/audit/review-bugs/reproduce-public-palette.mjs` and run it with Node from the repository root, using existing
compiled modules. It uses a deliberately small DOM fixture rather than a browser.

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ProfessionApp } from '#gw2/app/profession-app.js';
import { BaselineSimulationRunner } from '#gw2/app/simulation/baseline/runner.js';
import { createBuildTab, emptyBuildTabSession } from '#gw2/app/build/state/workspace.js';
import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import { mesmerAppAdapter as mesmer } from '#gw2/professions/mesmer/app/app-definition.js';
import { revenantAppAdapter as revenant } from '#gw2/professions/revenant/app/app-definition.js';
import { renderPalette } from '#gw2/app/rotation/palette/view.js';
import { createPaletteContext, paletteAvailability } from '#gw2/app/rotation/palette/model.js';
import { mountRotationHotkeys } from '#gw2/app/rotation/hotkeys.js';
const values = new Map();
globalThis.localStorage = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
const doc = {
  body: {
    dataset: {},
    removeAttribute() {},
    classList: {
      remove() {},
      contains() {
        return false;
      }
    }
  },
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => []
};
globalThis.document = doc;
globalThis.HTMLButtonElement = class {};
globalThis.FileReader = class {
  async readAsText(file) {
    this.result = await file.text();
    this.onload();
  }
};
function appFor(adapter, build = adapter.toApplicationBuild(adapter.profession.createBuildDefaults())) {
  const tab = createBuildTab(build, 'A');
  const app = Object.assign(Object.create(ProfessionApp.prototype), emptyBuildTabSession(), {
    adapter: { ...adapter, renderRotationBuilder() {} },
    profession: adapter.profession,
    activeCatalog: adapter.profession.catalog,
    skillById: adapter.profession.catalog.skillsById,
    skillByName: adapter.profession.catalog.skillsByName,
    skills: [...adapter.profession.catalog.skills],
    weaponData: adapter.weaponData,
    workspace: { tabs: [tab], activeTabId: tab.id },
    build,
    patchId: 'current',
    buildRevision: 1,
    resultRevision: -1,
    initialRenderGeneration: 0,
    simulationStatus: 'queued',
    simulationSettings: { transitionDelays: normalizeTransitionDelays(null) },
    randomDistributionRunner: { cancel() {}, schedule() {} },
    modifierContributionRunner: { cancel() {}, schedule() {} },
    relicComparisonRunner: { cancel() {}, schedule() {} },
    renderBuildSections() {}
  });
  app.baselineSimulationRunner = new BaselineSimulationRunner(app);
  app.adapter.recalculate(app);
  settle(app);
  return app;
}
function settle(app) {
  app.baselineSimulationRunner.cancel();
  const output = app.adapter.calculateBaselineSimulation(app.adapter.baselineSimulationRequest(app));
  app.commitBaselineSimulation(output, app.buildRevision, false);
  return output;
}
function activate(app, id) {
  app.activateBuildTab(id);
}

class FakeElement {
  constructor(attributes = {}) {
    this.attrs = attributes;
    this.dataset = {};
    for (const [k, v] of Object.entries(attributes))
      if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
    this.classList = {
      contains: (name) => (this.attrs.class || '').split(' ').includes(name),
      toggle() {},
      remove() {}
    };
  }
  getAttribute(name) {
    return this.attrs[name] ?? null;
  }
  setAttribute(name, value) {
    this.attrs[name] = value;
  }
  removeAttribute(name) {
    delete this.attrs[name];
  }
  querySelector() {
    return null;
  }
  append() {}
  closest() {
    return null;
  }
  dispatchEvent(event) {
    this.onclick?.({ ...event, currentTarget: this });
  }
}
globalThis.Node = globalThis.Element = globalThis.HTMLElement = FakeElement;
for (const freshen of [false, true]) {
  const build = revenant.toApplicationBuild(
    JSON.parse(fs.readFileSync('data/gw2/builds/revenant/b-power-vindicator-greatsword-energy.json', 'utf8'))
  );
  build.rotation = [];
  const app = appFor(revenant, build),
    listeners = {};
  const owner = {
    getElementById: () => ({}),
    createElement: () => new FakeElement(),
    addEventListener: (name, fn) => {
      listeners[name] = fn;
    },
    defaultView: {
      MouseEvent: class {
        constructor(type, options) {
          Object.assign(this, { type }, options);
        }
      },
      addEventListener() {}
    }
  };
  const root = new FakeElement();
  root.ownerDocument = owner;
  root.nodes = [];
  root.contains = (node) => root.nodes.includes(node) || node === root;
  Object.defineProperty(root, 'innerHTML', {
    set(html) {
      this.html = html;
      this.nodes = [...html.matchAll(/<div class="pal-skill[^>]*>/g)].map(([tag]) => {
        const attrs = Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
        const element = new FakeElement(attrs);
        element.ownerDocument = owner;
        return element;
      });
    },
    get() {
      return this.html;
    }
  });
  root.querySelectorAll = (selector) =>
    selector === '.pal-skill[data-skill]'
      ? root.nodes
      : selector === '.pal-skill[data-hotkey-action]'
        ? root.nodes.filter((n) => n.dataset.hotkeyAction)
        : [];
  const oldLookup = doc.getElementById;
  doc.getElementById = (id) => (id === 'rotation-palette' ? root : null);
  renderPalette(app);
  mountRotationHotkeys(root);
  const macro = root.nodes.find((n) => n.dataset.skill === '__vindicator_dodge_auto');
  assert.ok(macro);
  macro.dispatchEvent({ type: 'click', shiftKey: false, ctrlKey: false });
  assert.equal(app.build.rotation.length, 0);
  const skill = revenant.profession.ui
    .paletteActionSkills(createPaletteContext(app), [])
    .find((s) => s.id === '__vindicator_dodge_auto');
  console.log(
    'macro reachability',
    JSON.stringify({
      class: macro.attrs.class,
      verdict: paletteAvailability(app, createPaletteContext(app), skill),
      commandsAfterClick: app.build.rotation.length
    })
  );
  listeners.pointerdown({ target: root, button: 0 });
  const key = (code) =>
    listeners.keydown({
      code,
      target: root,
      isComposing: false,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      repeat: false,
      preventDefault() {}
    });
  key('Backquote');
  assert.equal(app.build.rotation.at(-1).skillId, -3);
  assert.ok(app.baselineSimulationRunner.pending);
  if (freshen) {
    settle(app);
    renderPalette(app);
    mountRotationHotkeys(root);
  }
  key('Digit1');
  const result = settle(app).result;
  console.log('hotkey', JSON.stringify({ freshen, rotation: app.build.rotation, warnings: result.warnings }));
  assert.equal(app.build.rotation.at(-1).skillId, freshen ? 29057 : 62913);
  assert.equal(
    result.warnings.some((w) => w.includes('Mist Swing')),
    !freshen
  );
  app.baselineSimulationRunner.cancel();
  doc.getElementById = oldLookup;
}
```
