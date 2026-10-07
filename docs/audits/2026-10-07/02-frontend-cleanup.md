# Frontend cleanup audit

Baseline: `061147ad40b62f032fb2f0da41f2dd4d9807eee3` (2026-10-07).

Status: initial audit complete. Findings below are source-backed; browser reproduction remains unavailable. The
application uses TypeScript and imperative DOM rendering, not React. No production changes were made.

## Correctness findings

### UI-001 — Elementalist cannot select its second equipment set in Attribute Preview

- **Classification:** bug / obsolete template condition. **Severity:** medium. **Confidence:** high.
- **Baseline locations:** `vite.config.js:23–28,89–95` (`professionPages.elementalist.singleWeaponSet` and
  `renderProfessionPages` substitutions); `templates/profession.html:175–182`;
  `js/games/gw2/app/build/panels/attributes.ts:20–26` (`renderAttributes`);
  `js/games/gw2/app/build/panels/gear.ts:224–227`; `js/games/gw2/app/session-controls.ts:16–22`.
- **Expected:** Attribute Preview can inspect either equipped weapon set independently of combat swap availability. This
  is explicitly the contract in `renderAttributes`; the equipment editor renders both sets for every profession.
- **Observed:** Elementalist alone has `singleWeaponSet: true`. The build transform removes its `<option value="2">`,
  even though `renderAttributes` subsequently reveals and enables the selector when `alternateWeapons[0]` exists.
  Runtime rendering changes the selected value and visibility, but never inserts an option. The existing built
  `dist/site/elementalist.html` contains only option `1`; Engineer and Guardian contain both `1` and `2`.
- **Trigger/impact:** equip an alternate Elementalist weapon set with different prefixes/sigils, then try to inspect its
  attributes. The visible selector offers only set 1. This concerns preview controls, not permission to swap during
  combat.
- **Reproduction:** open `/elementalist.html#workspace`, equip Weapon set 2, inspect `#attribute-weapon-set` options.
  Artifact diagnostic (executed against the coordinator's baseline build):

  ```js
  import fs from 'node:fs';
  for (const id of ['elementalist', 'engineer', 'guardian']) {
    const html = fs.readFileSync(`dist/site/${id}.html`, 'utf8');
    console.log(id, html.match(/<select\b[^>]*id="attribute-weapon-set"[^>]*>([\s\S]*?)<\/select>/)[1]);
  }
  ```

  Result: Elementalist has `<option value="1">1</option>` only; the two controls also contain
  `<option value="2">2</option>`. No browser interaction was claimed.

- **Smallest recommendation:** always emit both Attribute Preview options and let `renderAttributes` own whether a
  second equipped set exists. Remove only the option/visibility template coupling; do not remove Elementalist's distinct
  theme handling just because it shares the `singleWeaponSet` flag.
- **Risk/validation:** low implementation risk. Add the Elementalist case to `tests/browser/buffed-attributes.spec.js`:
  equip distinct alternate gear, select 2, verify preview attributes and preservation of preview inputs; remove
  alternate gear and verify selection returns to 1. Keep combat swap restrictions unchanged. Existing preview browser
  tests exercise Mesmer and do not cover this template branch.
- **Related:** no matching issue established in supplied issue inventory; no external game-mechanics claim required.

### UI-004 — Profession-specific skill selectors discard keyboard focus after selection

- **Classification:** bug / accessibility. **Severity:** medium. **Confidence:** high for the missing restoration and
  detached-control path; browser focus behavior was not executed here.
- **Baseline locations:** `js/games/gw2/app/build/panels/skills.ts:197–221,226–270,391–415` (`renderSkills`,
  profession-selection and fixed-loadout handlers); `js/games/gw2/app/profession-app.ts:202–213,495–499`;
  `js/games/gw2/app/build/editor.ts:25–32`; `js/ui/shared/dropdown-search.ts:80–85,88–91`.
- **Expected:** committing a keyboard selection should leave focus on the replacement selector so the user can continue
  through adjacent build controls. The ordinary heal/utility/elite handler already implements this at
  `js/games/gw2/app/build/panels/skills.ts:220–221`.
- **Observed:** the profession-selection handler calls `app.changed()` and returns; the icon-based Revenant loadout
  handler does the same. The default `changed()` path synchronously renders the Skills section, assigning
  `skillBar.innerHTML` and removing the focused dropdown option. Neither path reacquires/focuses the new trigger.
  `bindDropdownSearch` does not restore focus when Enter commits a selection; it invokes the option's `.click()` and
  delegates completion to the owner. Its Escape restoration targets the old trigger and is not involved in selection.
- **Trigger/impact:** choose a Ranger pet (also applies to the shared morph/hammer selector path), or choose a Revenant
  legend, using the search/arrow/Enter flow. The focused option is removed with no replacement focus target,
  interrupting sequential keyboard editing. This is a focus-continuity defect, not a claim that the controls cannot be
  reached again.
- **Reproduction/trace:** in `/ranger.html#workspace`, focus a pet selector, open it with Enter, search for another pet,
  press ArrowDown then Enter, and inspect `document.activeElement`. Compare with a Utility selection, which explicitly
  focuses its replacement trigger. A focused inert-handler diagnostic executed the actual compiled renderer with the
  real Ranger adapter: a standard Utility handler called `changed()` and `.focus()` once; `selectedPet` called
  `changed()` but `.focus()` zero times. It did not simulate browser focus defaults. The complete fixture is retained
  below.
- **Smallest recommendation:** capture the selection identity before `changed()`, then query/focus the replacement
  trigger by selection key/index; provide an equally stable legend-selector identity. Reuse the ordinary-slot
  restoration pattern. Avoid preserving the removed option or making the shared dropdown helper focus a detached
  trigger.
- **Risk/validation:** low-to-medium. A specialization change can remove a selector, so guard the lookup and choose a
  nearby surviving control only when necessary. Browser regression cases should commit Ranger pets, Engineer morphs, and
  Revenant legends with Enter and verify focus on the corresponding new trigger, followed by Tab to the next control.
  Confirm pointer selection behavior and tooltip interaction remain unchanged.
- **Related:** UI-002 shares the Revenant renderer but removing hidden bars does not fix focus. No matching issue was
  established in the supplied recent issue inventory.

## Cleanup findings

### UI-002 — Stop constructing the permanently hidden Revenant fixed skill bars

- **Classification:** cleanup (unnecessary rendering, not dead selectors). **Severity:** low. **Confidence:** high.
- **Baseline locations:** `js/games/gw2/app/build/panels/skills.ts:275–330,374–392` (`renderFixedSlotLoadout`,
  `slotHtml`, `barSkillHtml`, `barHtml`); `css/build-editor.css:1430–1437`; `css/skill-bar.css:409–428,443–501`;
  `templates/profession.html:82–86`.
- **Expected:** the build area provides editable legend selectors; fixed skills are already available in the rotation
  palette. The CSS comment states this intent explicitly.
- **Observed:** every shipped Revenant workspace places `#skill-bar` under `.workspace-build-choices`. The
  unconditional, profession-specific rule sets every `.fixed-loadout-bar` to `display: none`. Nevertheless each
  `renderSkills` constructs root skill tiles, child chains, images, tabindex attributes, and simulation tooltip metadata
  before inserting those bars. No production script reveals them; all additional matching bar CSS is less specific and
  has no `!important` display override. This is executed hidden rendering, not unreachable code.
- **Trigger/impact:** startup and static build refreshes on Revenant generate invisible duplicated skill content and
  retain its CSS/renderer complexity. No timing or user-perceived speed claim is made.
- **Focused diagnostic:** invoked the actual compiled `renderSkills` with the real Revenant adapter/default build and an
  inert markup-capture host. It emitted **2 bars, 15 fixed skill tiles, 2 legend selectors**, and 27 tooltip attribute
  sets. The fixture deliberately does not emulate layout; invisibility follows from the shipped template/cascade trace.
- **Smallest recommendation:** render only the two legend selectors in this build area and remove the now-unneeded local
  bar/child markup plus CSS exclusively styling that removed subtree. Keep selector wrappers if necessary to preserve
  their existing layout. Keep `slotLoadout.view().bars`, `skillChildren`, and the profession loadout contract:
  `js/games/gw2/app/rotation/palette/model.ts:821` and `js/games/gw2/app/build/skill-damage/plan.ts:217` consume them
  independently. Do not remove the domain model as “unused.”
- **Risk/validation:** low-to-medium because broad `.skill-bar-selected` styles and `.fixed-loadout-pairs` responsive
  layout also serve retained selectors. Verify Revenant legends, disabled elite options, keyboard search and focus,
  palette flips/children, and desktop/narrow/embedded layouts. Run focused Revenant loadout and skill-damage contracts;
  require screenshots before deleting layout wrappers. Keep game mechanics and palette contents unchanged.
- **Related:** UI-004 covers the separate selector-focus defect; no matching known issue established.

### UI-003 — Delete shadowed health-chart declarations instead of retaining two base layouts

- **Classification:** cleanup / redundant CSS declarations. **Severity:** low. **Confidence:** high.
- **Baseline locations:** `css/benchmarks.css:1015–1026,1073–1111` and overriding blocks at `1313–1338,1363–1387`;
  loaded by `css/style.css:22`. Both sets are unconditional rules in the same stylesheet and cascade layer.
- **Expected:** one readable base declaration per property, with responsive overrides where required.
- **Observed:** earlier values are always superseded by later rules with exactly the same selector/specificity,
  including `.health-chart-layout` `grid-template-rows`, `.health-chart-layout.has-health-pins` `grid-template-columns`
  and `min-width`, `.health-values` `margin-top` (later `margin: 0`), `.health-table-scroll` `margin-top` and
  `overflow-x` (later `overflow: auto`), `.health-values :is(th, td)` `padding`, `.health-values th:first-child`
  `min-width`, and `.health-pin-status` `margin-top` (later `margin: 0`). These are redundant declarations, not dead
  selectors: the chart and table are active UI.
- **Trigger/impact:** every health-chart render loads both generations of base layout. Edits to the earlier values have
  no effect, increasing maintenance ambiguity. No runtime performance gain is asserted.
- **Reproduction/method:** parsed all 24 stylesheets with the installed PostCSS parser, grouping identical selectors by
  their complete at-rule ancestry; inspected each duplicate and intervening/responsive rules. The listed later
  declarations are unconditional and use supported values already required by the UI. Media/container rules remain
  separate and must not be flattened.
- **Smallest recommendation:** remove only the listed earlier shadowed declarations first. Optionally consolidate their
  remaining base properties in a later follow-up while preserving cascade order; do not mass-deduplicate by selector
  name.
- **Risk/validation:** low for deletion of earlier declarations; higher for moving blocks relative to competing
  selectors. Compare computed styles/screenshots for Health view with/without pinned labels, narrow container stacking,
  and small viewport horizontal scrolling. Preserve the later responsive rules at `1445` onward.
- **Related:** UI-002 is a separate hidden-markup cleanup; no matching known issue established.

## Coverage inventory and focused validation

Read project README, architecture/module ownership documents, platform README, and script/test contribution conventions.
Coordinator reports baseline `npm run check` passed (4,876 Node tests); broad checks were not repeated. No
source/test/config edits, builds, Git mutations, package installs, or browser-installer retries were performed by this
auditor.

| Area                                 | Actual examination                                                                                                                                                                                                                                                                                                            | Result / limit                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Stylesheet loading and cascade       | Parsed all 24 `css/` stylesheets with installed PostCSS; reviewed imports in `css/style.css`, `css/patch-preview.css`, root HTML and `templates/profession.html`; grouped exact selectors with at-rule ancestry.                                                                                                              | All sheets are loaded through a page/import chain. UI-003 records unconditional shadowing. No entire stylesheet is recommended for deletion.                                                                                                                                                                                                                                         |
| Selector producers                   | Literal candidate scan across `js/`, `templates/`, `data/`, `scripts/` and root HTML, followed by manual dynamic-producer tracing, template transformation and cascade checks.                                                                                                                                                | 51 initially absent literal class names were explained by generated class families; none is a confirmed dead-selector finding. UI-002 is intentionally distinguished as _present but permanently hidden_ markup.                                                                                                                                                                     |
| Module/export inventory              | TypeScript AST string/import-reference inventory of all 180 modules in `js/browser/`, `js/ui/`, and `js/games/gw2/app/`, plus script and HTML consumers; separate exported-symbol reference screening.                                                                                                                        | The apparent no-inbound module `js/games/gw2/app/page/benchmark-preview-generation.ts` is actually loaded via Vite `ssrLoadModule` by `scripts/build/benchmark-previews.mjs:30–32`. `targetHealthBandDps` is used by analysis tooling. No production file/export deletion is justified by this inventory. This is reference screening, not a proof of complete dynamic reachability. |
| Page/template startup and navigation | `js/browser/bootstrap.ts`, `js/browser/entry.ts`, `js/browser/page/dialog.ts`, `js/browser/page/embed.ts`, `js/browser/shell/rotation-workspace.ts`, `js/browser/shell/result-view.ts`; `js/games/gw2/app/page/entry.ts`, `js/games/gw2/app/page/navigation.ts`; `vite.config.js` and shared template.                        | Traced lazy profession/dashboard loading, deferred first paint, loader recovery, settings portaling, native dialogs/popovers, iframe tracking, focus mode, and view synchronization. UI-001 derives from the obsolete template branch. Host/viewport behavior remains unverified in a browser.                                                                                       |
| Build/editor controls                | `js/games/gw2/app/profession-app.ts`, `js/games/gw2/app/define-profession-app.ts`, `js/games/gw2/app/create-runtime.ts`, `js/games/gw2/app/build/editor.ts`, panels for gear/skills/attributes/workspace tabs/skill damage, state workspace, session controls, isolated preview, shared equipment picker and tooltip overlay. | Traced synchronous DOM replacement, selection handlers, per-tab versus shared state, preview inputs and worker signatures. UI-002/UI-004 have focused fixtures. Persistence/worker correctness was coordinated with the general-bugs auditor.                                                                                                                                        |
| Profession presentation boundary     | Read all nine profession app definitions under `js/games/gw2/professions/`; inspected Core presentation producers across all nine professions and specialized Firebrand/Ranger/Thief class producers; traced Revenant loadout through palette and skill-damage consumers.                                                     | Existing native UI contracts and `defineProfessionApp` already centralize composition. Differences in per-profession configuration were not treated as duplication defects. Not a line-by-line mechanics audit of every specialization.                                                                                                                                              |
| Rotation/results                     | `js/games/gw2/app/rotation/builder.ts`, timeline view/state/preferences/interactions, palette view/resource-view and selected model paths; neutral duration/floating editors; results view/state/summary/section models, chart interaction/lifecycle sections, skill-damage view model.                                       | Checked render ownership, active/stale views, resource/proc classes, summary mirror delegation, row replacement and editor cleanup. Duplicated short render sequences were not inflated into a refactor finding. Numerical combat correctness was outside this audit.                                                                                                                |
| Benchmark and optimizer views        | Benchmark comparison view/style model, health interaction observer lifecycle, benchmark CSS; optimizer gear panel/view and relic-comparison panel; result-chart lifecycle sections.                                                                                                                                           | Reviewed conditional rendering, retained selections, popover/dialog states and chart teardown candidates. No benchmark or UI latency measurements were made.                                                                                                                                                                                                                         |
| Patch authoring UI                   | `patch-preview.html`, stylesheet import/root theme; `js/games/gw2/integrations/patches/app/index.ts`, `js/games/gw2/integrations/patches/app/editor-state.ts`, mutation/render handler sections of `js/games/gw2/integrations/patches/app/render.ts`.                                                                         | Checked pending-request guards, delegated handlers, generated overview normalization and render replacement. Did not execute local authoring server or save a preview.                                                                                                                                                                                                               |
| Existing tests and issues            | Inspected browser tests for attributes, skill damage, equipment dropdowns, dialogs/embed focus, and Node loadout/presentation fixtures; searched supplied issue titles for weapon/attribute/focus/UI topics.                                                                                                                  | Existing tests supplied useful contracts; none was claimed to run in a browser. Closed issue #91 concerns a Specter preset's starting weapon set, not UI-001. Historical issue coverage is limited to supplied inventories.                                                                                                                                                          |

Executed diagnostics (all exit 0):

1. `node .scratch/audit/ui/import-inventory.mjs`: scanned 1,600 source modules, screened 180 frontend modules; the sole
   flagged module had the build-tool consumer noted above.
2. `node .scratch/audit/ui/exports.mjs`: exported-symbol frequency screening; manually rejected the low-frequency
   candidates with tooling/local callers. No finding is based on frequency alone.
3. PostCSS exact-selector/at-rule duplicate inventory: found UI-003; legitimate separate-page roots, responsive rules,
   and complementary declarations were retained.
4. Built HTML option extraction shown in UI-001: Elementalist `1`, Engineer/Guardian `1, 2`. A real-adapter headless
   recalculation with alternate Staff/Minstrel prefixes returned Power **2,880 for set 1** and **2,614 for set 2**,
   confirming that the preview calculation supports the missing choice; these are diagnostic fixture values, not game
   benchmarks.
5. `node .scratch/audit/ui/render-hidden-loadout.mjs`:
   `{"bars":2,"skillTiles":15,"selectors":2,"tooltipAttributes":27}`.
6. `node .scratch/audit/ui/selector-focus.mjs`:
   `{"selectionKey":"selectedPet","standardFocusCalls":1,"specializedFocusCalls":0,"changes":2}`.

All four JavaScript snippets included below/in UI-001 were extracted from the final Markdown and executed with Node;
each exited 0. The report was formatted with the required touched-file Prettier command.

Scratch scripts are not part of the deliverable; the important fixtures and reproduction traces are reproduced in this
report.

Browser limitation: Chrome is absent; coordinator's system installation was blocked by package-manager privileges, and
user-space Chromium downloads were invalid/truncated. No browser/layout/focus assertions were executed. Source traces
and inert DOM fixtures are explicitly distinguished from real browser verification.

## Hypotheses and remaining gaps

These observations are **not additional confirmed findings** and should not be treated as approved deletions or measured
regressions:

- Skill-damage disclosure/filter/row actions replace their own focused subtree
  (`js/games/gw2/app/build/panels/skill-damage.ts:102–120,160–165,174–216`). This resembles UI-004, but the diagnostic
  covered profession selectors only. Verify summary/filter/expanded-row focus, worker completion during interaction, and
  scroll anchoring in a browser before broadening the fix.
- Settings uses `toggleAttribute('aria-modal', state.configOpen)` (`js/browser/shell/rotation-workspace.ts:102`), which
  creates an empty attribute value. Clarify intended non-embedded drawer semantics versus native embedded modality, then
  verify accessibility-tree output and focus containment. Do not blindly advertise the standalone drawer as modal while
  background controls remain interactive.
- Time-series chart remount cleanup disconnects observers only when the _same_ chart container is reused
  (`js/games/gw2/app/results/charts/time-series-view.ts:643,974–984`); result-section rendering replaces that container
  (`js/ui/results/simulation-view.ts:21–25`, `js/games/gw2/app/results/charts/section-view.ts:40–52`). Old-observer
  teardown deserves a lifecycle probe when repeatedly switching/recalculating Analysis. No browser heap measurement or
  retained-object claim was made. The health-chart interaction owner does explicitly reconnect its observer when its
  layout changes.
- Revisions, caches, saved preview values, keyed timeline reconciliation, and on-demand charts are generally
  intentional. No React hooks/effects exist to remove; a rewrite to a new state framework is not justified by these
  findings.
- Static reference screening cannot prove a selector unobservable under every elite, theme, responsive size, imported
  build, popover/top-layer state or iframe host. Final cleanup should run the affected browser tests, compare
  desktop/mobile/embed screenshots, and check keyboard/screen-reader behavior. Performance was not benchmarked.

### Dynamic class checks that prevented false dead-code findings

| Initially absent literal family                                            | Production producer / reason retained                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.profession-loadout-theme`, `.profession-card-*`                          | `vite.config.js:95`; `js/games/gw2/app/page/entry.ts` and `js/games/gw2/app/page/navigation.ts` generate theme/card identities.                                                                                                                                             |
| `.sd-unslotted`, golem limb classes                                        | `js/games/gw2/app/build/panels/skill-damage.ts:400–405,452` emits `sd-${row.status}` and `sd-golem-${part}`; reduced-motion rules select the still image.                                                                                                                   |
| `.resource-above`, `.resource-beside`, pip row/count classes               | `js/games/gw2/app/rotation/palette/view.ts:271`; `js/games/gw2/app/rotation/palette/resource-view.ts:218`; profession definitions choose placement/capacity.                                                                                                                |
| `.rot-sigil-proc`, `.rot-relic-proc`, `.rot-trait-proc`                    | `js/games/gw2/app/rotation/timeline/rows.ts:344` formats proc type.                                                                                                                                                                                                         |
| `.log-source-*`, `.log-badge-*`                                            | `js/ui/results/event-log.ts:226,490` formats normalized source types.                                                                                                                                                                                                       |
| `.pick-1/2/3`, Ranger specialization layouts                               | `js/games/gw2/app/build/panels/traits.ts:120–121`; `js/games/gw2/professions/ranger/core/presentation.ts:230–231`.                                                                                                                                                          |
| `.mesmer-skill-breakdown`, dormant tome classes, Antiquary artifact groups | `js/games/gw2/app/results/view.ts` formats adapter ID; `js/games/gw2/professions/guardian/specializations/firebrand/presentation.ts:102` formats tome names; `js/games/gw2/professions/thief/specializations/antiquary/presentation.ts:151–160` formats artifact group IDs. |

## Reproducible focused fixtures

Run from the repository root after the ordinary baseline build; these diagnostics do not modify source or results. They
use compiled package aliases. Inert hosts record calls/markup and do not emulate CSS layout or browser focus defaults.

### Supported Elementalist preview calculation (UI-001)

```js
import { elementalistAppAdapter as adapter } from '#gw2/professions/elementalist/app/app-definition.js';
const catalog = adapter.profession.catalog;
const build = adapter.profession.createBuildDefaults();
build.alternateWeapons = ['Staff', ''];
build.alternateWeaponPrefixes = ["Minstrel's", "Minstrel's"];
const app = {
  adapter,
  profession: adapter.profession,
  activeCatalog: catalog,
  skillById: catalog.skillsById,
  skillByName: catalog.skillsByName,
  skills: [...catalog.skills],
  weaponData: adapter.weaponData,
  build,
  patchId: 'current',
  attributeWeaponSet: 1,
  results: null
};
for (const set of [1, 2]) {
  app.attributeWeaponSet = set;
  adapter.recalculate(app);
  console.log(set, app.attributeData.attributes.Power.final);
}
// Baseline output: 1 2880; 2 2614.
```

### Hidden loadout markup (UI-002)

```js
import assert from 'node:assert/strict';
import { renderSkills } from '#gw2/app/build/panels/skills.js';
import { revenantAppAdapter as adapter } from '#gw2/professions/revenant/app/app-definition.js';
const catalog = adapter.profession.catalog;
const host = {
  innerHTML: '',
  classList: { remove() {} },
  querySelectorAll: () => [],
  parentElement: { querySelector: () => ({}) }
};
globalThis.document = { getElementById: (id) => (id === 'skill-bar' ? host : null) };
renderSkills({
  adapter,
  profession: adapter.profession,
  build: adapter.profession.createBuildDefaults(),
  activeCatalog: catalog,
  skillById: catalog.skillsById,
  patchId: 'current',
  results: null
});
const bars = (host.innerHTML.match(/class="fixed-loadout-bar /g) || []).length;
const tiles = (host.innerHTML.match(/class="skill-bar-slot fixed-loadout-skill/g) || []).length;
const selectors = (host.innerHTML.match(/data-loadout-toggle/g) || []).length;
assert.equal(bars, 2);
assert.equal(tiles, 15);
assert.equal(selectors, 2);
console.log({ bars, tiles, selectors });
```

### Selection-handler focus calls (UI-004)

```js
import assert from 'node:assert/strict';
import { renderSkills } from '#gw2/app/build/panels/skills.js';
import { rangerAppAdapter as adapter } from '#gw2/professions/ranger/app/app-definition.js';
class ElementFixture {
  constructor(dataset = {}) {
    this.dataset = dataset;
    this.handlers = new Map();
    this.classList = { toggle() {}, remove() {} };
    this.innerHTML = '';
  }
  addEventListener(name, callback) {
    this.handlers.set(name, callback);
  }
  querySelectorAll() {
    return [];
  }
}
globalThis.HTMLElement = ElementFixture;
const build = adapter.profession.createBuildDefaults();
const catalog = adapter.profession.catalog;
const groups = adapter.profession.ui.skillBarGroups({
  build,
  specialization: adapter.eliteSpecialization(build),
  catalog
});
const selection = groups.flatMap((group) => group.selections || []).find((s) => s.optionEntries?.length);
const option = selection.optionEntries.find((o) => String(o.value) !== String(selection.selectionValue));
let changes = 0;
let focusCalls = 0;
const standardSlot = new ElementFixture({ key: 'Utility1' });
const standardOption = new ElementFixture({ skillId: JSON.stringify(build.selectedSkillIds.Utility1) });
const specialSlot = new ElementFixture({
  selectionKey: selection.selectionKey,
  selectionIndex: String(selection.selectionIndex)
});
const specialOption = new ElementFixture({
  selectionValue: String(option.value),
  ...(option.skillId == null ? {} : { skillId: String(option.skillId) })
});
standardSlot.querySelectorAll = () => [standardOption];
specialSlot.querySelectorAll = () => [specialOption];
const host = new ElementFixture();
host.querySelector = () => ({
  focus() {
    focusCalls++;
  }
});
host.querySelectorAll = (selector) =>
  selector === '.skill-bar-slot[data-key]'
    ? [standardSlot]
    : selector === '.skill-bar-inspection-slot[data-selection-key]'
      ? [specialSlot]
      : [];
globalThis.document = { getElementById: () => host, querySelector: () => null };
renderSkills({
  adapter,
  profession: adapter.profession,
  activeCatalog: catalog,
  skillById: catalog.skillsById,
  skillByName: catalog.skillsByName,
  skills: [...catalog.skills],
  build,
  patchId: 'current',
  results: null,
  changed() {
    changes++;
  }
});
standardOption.handlers.get('click')({ stopPropagation() {} });
assert.equal(focusCalls, 1);
focusCalls = 0;
specialOption.handlers.get('click')({ stopPropagation() {} });
assert.equal(changes, 2);
assert.equal(focusCalls, 0);
```
