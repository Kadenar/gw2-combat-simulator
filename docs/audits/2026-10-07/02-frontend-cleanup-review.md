# Frontend cleanup independent review

Baseline: `061147ad40b62f032fb2f0da41f2dd4d9807eee3` (2026-10-07). Reviewed report:
[02-frontend-cleanup.md](./02-frontend-cleanup.md), frozen at 05:07:57 UTC. Status: complete. The initial report and all
production source, tests, configuration, and Git state were left unchanged.

The two UI defects and two narrowly scoped cleanup findings survive independent review. UI-004 needs a precise
distinction between Enter in a search input and native activation of a focused option. No new reviewer discovery is
promoted to a finding. The unnumbered lifecycle/accessibility hypotheses remain unproven as user-visible defects.

## Complete disposition table

| Original ID | Disposition                | Final classification                 | Final severity | Final confidence                                                                       | Change to recommendation or risk                                                                                                                       |
| ----------- | -------------------------- | ------------------------------------ | -------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| UI-001      | confirmed                  | bug                                  | medium         | high                                                                                   | Emit both options independently of the Elementalist theme flag; retain runtime visibility/reset logic and combat restrictions.                         |
| UI-004      | confirmed with corrections | bug / accessibility                  | medium         | high for missing restoration and synchronous replacement; browser aftermath unverified | Correct the two Enter paths; validate search-input Enter and option Enter/Space separately, including both pet slots and conditional selector removal. |
| UI-002      | confirmed                  | cleanup                              | low            | high for shipped workspace markup and cascade                                          | Restrict deletion to the fixed-bar subtree and its exclusive CSS; retain selectors, their wrappers, and the loadout model consumed elsewhere.          |
| UI-003      | confirmed                  | cleanup / redundant CSS declarations | low            | high                                                                                   | Delete the nine identified earlier declarations; preserve partial shorthands, complementary declarations, and later conditional rules.                 |

Severity and confidence assess the final claim independently. None of these cleanup findings demonstrates a measured
performance regression or gain.

## Findings reviewed against baseline

### UI-001 — Elementalist's second Attribute Preview weapon option is omitted

**Disposition: confirmed. Classification: bug. Severity: medium. Confidence: high.**

The expected behavior is explicit in `js/games/gw2/app/build/panels/attributes.ts:20–25` (`renderAttributes`): an
equipped alternate set can be previewed even when combat swapping is unavailable.
`js/games/gw2/app/build/panels/gear.ts:223–226` renders both equipment sets for every profession. This is an internal UI
contract; no external claim about Elementalist combat rules is needed.

The complete source path supports the report:

- `vite.config.js:23–28` gives only Elementalist `singleWeaponSet: true`; `renderProfessionPages`,
  `vite.config.js:89–95`, substitutes an empty string for its second option.
- `templates/profession.html:175–182` contains option 1 and the substituted option-2 placeholder. Its own comment
  describes a two-option native control.
- `renderAttributes` reveals/enables the existing selector when alternate main-hand equipment exists and assigns a
  value, but does not create options (`js/games/gw2/app/build/panels/attributes.ts:15–25`). No alternate producer of
  `attribute-weapon-set` options was found in the production source search.
- `bindSessionControls`, `js/games/gw2/app/session-controls.ts:16–20`, accepts set 2, recalculates, and renders
  attributes. The calculation also selects it in `js/games/gw2/app/build/buffed-attributes.ts:82–103`; this is not a
  UI-only unsupported value.

**Independent execution:** fixture A below invokes the actual Vite transform, without starting Vite or rebuilding, for
all nine pages in both `serve` and `build` modes. All 18 checks agree with the existing `dist/site` artifacts:
Elementalist has `[1]`; all other professions have `[1,2]`. A deliberately partial control fixture executes
`renderAttributes` up to its missing-attribute-data guard: an alternate Staff enables/reveals the control; removing
alternate equipment disables/hides it and resets the app value to 1. This fixture records assignments, not native select
behavior. Real Elementalist adapter recalculation with alternate Staff/Minstrel prefixes returns Power 2,880 versus
2,614 for sets 1 and 2, respectively.

**Counterexamples checked:** the missing option persists in development and production transforms; runtime visibility
does not repair it. Conversely, with no alternate equipment the selector should remain hidden, so merely displaying it
permanently would be incorrect. Removing `singleWeaponSet` wholesale also changes `{{loadout-theme}}` at
`vite.config.js:95` and is outside the fix. Removal of an alternate weapon resets preview state through
`js/games/gw2/app/build/panels/gear.ts:248–254` as well as the attribute renderer.

**Impact and recommendation:** a user who equips a distinct second Elementalist set cannot choose it in the native
Attribute Preview control. Emit both options and leave eligibility/visibility to `renderAttributes`. Keep the existing
theme behavior, either retaining the flag only for that purpose or renaming it in a separate small cleanup. Risk remains
low for that narrow change; do not change combat-swap eligibility. Extend `tests/browser/buffed-attributes.spec.js` with
Elementalist alternate gear, set-2 selection, retained preview inputs, and reset after removal. Its existing
set-switching cases visit Mesmer (`tests/browser/buffed-attributes.spec.js:6,37,85,120–122`). No browser reproduction
was executed here.

### UI-004 — Profession selectors omit focus restoration after rebuilding

**Disposition: confirmed with corrections. Classification: bug / accessibility. Severity: medium. Confidence: high for
the source-level defect; native focus consequences were not executed.**

The local expected behavior is established by the ordinary slot handler: after `app.changed()` it finds the new trigger
and focuses it (`js/games/gw2/app/build/panels/skills.ts:205–221`). Comparable profession selectors should preserve this
keyboard continuation when their selected option causes the same rebuild.

The exact synchronous chain is `ProfessionApp.changed()` → `renderBuildSections()` → the `skills` editor contribution →
replacement of `skillBar.innerHTML` (`js/games/gw2/app/profession-app.ts:204–213,495–499`;
`js/games/gw2/app/build/editor.ts:16–21`; `js/games/gw2/app/build/panels/skills.ts:195–199,389–390`). The profession
selection handler ends at `app.changed()` (`js/games/gw2/app/build/panels/skills.ts:226–270`); the icon-loadout handler
does likewise (`js/games/gw2/app/build/panels/skills.ts:405–415`). Neither reacquires a trigger. Search-input and option
nodes both belong to the replaced subtree.

**Correction to the keyboard trace:** `bindDropdownSearch` explicitly calls the first available option's `.click()` only
when Enter originates in the search input (`js/ui/shared/dropdown-search.ts:81–85`). After ArrowDown, focus is on an
option (`js/ui/shared/dropdown-search.ts:102–114`); Enter is not handled by that branch or by navigation/typing handling
(`js/ui/shared/dropdown-search.ts:88–91`). The option is a native button, so its normal activation supplies the click.
The original reproduction is plausible, but its explanation should not imply the helper directly handles both Enter
paths. Escape is a genuine counterexample: it closes the existing menu and focuses the existing trigger without
rebuilding (`js/ui/shared/dropdown-search.ts:73–78`).

**Independent execution:** fixture B calls the actual compiled renderer, actual shared dropdown helper, and real Ranger,
Engineer, and Revenant adapters. It exercises default Ranger utility, pet and hammer selectors, Engineer with Amalgam
selected, and a Revenant legend. Every committed choice changes the real build and synchronously invokes a second
`renderSkills` through the fixture's `changed` method. Search-input Enter logs:

| Choice           | Recorded focus/change calls                   |
| ---------------- | --------------------------------------------- |
| Ordinary Utility | `focus:input`, `changed`, `focus:replacement` |
| Ranger pet       | `focus:input`, `changed`                      |
| Ranger hammer    | `focus:input`, `changed`                      |
| Engineer morph   | `focus:input`, `changed`                      |
| Revenant legend  | `focus:input`, `changed`                      |

The same fixture verifies that ArrowDown focuses an option and Escape focuses the trigger for all five controls. It does
**not** simulate native option Enter/Space activation, actual node removal focus defaults, tab traversal, or layout. The
defective restoration is directly demonstrated; an exact resulting `document.activeElement` or Tab destination is not
claimed.

**Alternate/conditional paths:** Ranger's selection keys are authored in
`js/games/gw2/professions/ranger/core/presentation.ts:211–244`, and hammer eligibility/update is guarded at `138–168`.
Amalgam emits `selectedMorphSkillIds` and validates changes in
`js/games/gw2/professions/engineer/specializations/amalgam/presentation.ts:68–107`. The native-select loadout fallback
also lacks restoration (`js/games/gw2/app/build/panels/skills.ts:361–370,394–402`), but shipped Revenant uses icons
(`js/games/gw2/professions/revenant/build/legend-loadout.ts:147–158`). Do not expand current user impact to an unshipped
native-select implementation. Disabled options are filtered by `available()` (`js/ui/shared/dropdown-search.ts:39`); no
selection means no rebuild. Escape or an empty search therefore does not trigger this finding.

**Impact and recommendation:** successful keyboard selection removes the active input/option and lacks the ordinary
handler's focus continuation. Capture stable selection identity and focus the replacement trigger after `changed()`. Use
selection key plus index for pets/hammer/morphs; add or derive a stable legend identity rather than retaining a detached
trigger. Low-to-medium regression risk: key/index lookup must tolerate a selector disappearing, and an asynchronous
simulation update should not steal focus later. Keep focus restoration owned by the commit handler rather than
unconditionally restoring the helper's old trigger.

Extend `tests/browser/equipment-picker.spec.js:103–145`: its existing tests verify ordinary option activation, pet
search-input selection, and legend Escape restoration, but do not assert focus after a successful profession selection.
Add both Enter routes, option Space, both pet slots, hammer/morphs/legends, and a subsequent Tab. Test pointer behavior
too. UI-002's hidden-bar removal is independent and will not fix this defect.

### UI-002 — Shipped Revenant build renders skill bars that its CSS always hides

**Disposition: confirmed. Classification: cleanup. Severity: low. Confidence: high.**

The expected layout intent is documented in the source comment at `css/build-editor.css:1430`: keep editable legends and
omit fixed skills already available in the palette. The actual shared template places `#skill-bar` under
`.workspace-build-choices` and renders `body[data-profession="revenant"]` (`templates/profession.html:10–15,82–86`;
`vite.config.js:89–95`).

`renderSkills` takes the fixed-loadout path whenever the adapter provides it
(`js/games/gw2/app/build/panels/skills.ts:130–140`). `renderFixedSlotLoadout` computes bar roots, children, image
markup, focusable icons, and tooltip metadata (`js/games/gw2/app/build/panels/skills.ts:291–328`) and inserts them in
both paired and unpaired layouts (`373–390`). This is executed production work, not an unreachable renderer.

The unconditional hiding rule is
`body[data-profession='revenant'] .workspace-build-choices .fixed-loadout-bar { display: none; }`
(`css/build-editor.css:1435–1437`). Although `css/skill-bar.css` loads later (`css/style.css:9,19`), its bar display
rules at `css/skill-bar.css:409–415,443–451` have lower specificity. Active/inactive/static variants change styling, not
the hiding rule. Descendant hover rules cannot reveal a `display:none` ancestor. The matching production source search
found no relocation/reveal path for these bars. Embedded settings portaling moves the config panel, not the skill bar
(`js/browser/shell/rotation-workspace.ts:248–268`). This establishes invisibility for the shipped workspace, not
arbitrary external hosts that call the renderer without its stylesheet/ancestor contract.

**Independent execution:** fixture A renders the real default Revenant adapter and confirms 10 root stacks and 15 total
skill tiles. It then selects two enabled legend options in each of Core, Herald, Renegade, Vindicator, and Conduit
contexts, using real build specialization fields. Every case emits two bars and two icon selectors; total tiles vary
with chosen legends/children (10, 11, 10, 11, 10 in this fixture). These counts are not invariant across legend pairs.
The original default-configuration count is independently supported; no timing or browser visibility measurement was
attempted.

**Deletion boundary and counterexamples:** `view().bars` and `skillChildren()` remain live outside this panel:
`js/games/gw2/app/rotation/palette/model.ts:796,820–821` and `js/games/gw2/app/build/skill-damage/plan.ts:211–218`.
Revenant's authored children include facet consumes and Unyielding Impact
(`js/games/gw2/professions/revenant/build/legend-loadout.ts:164–170`). The fallback `selectionControl !== 'icons'` and
unequal selector/bar counts are generic supported renderer branches, even though the current Revenant configuration uses
two icons and two bars. Scope the cleanup to this build view; do not remove the platform contract, children, or palette
content.

**Recommendation and risk:** stop emitting `barHtml` and its exclusive root/child subtree in this build view. Delete
only exclusive bar/stack/chain rules after checking each selector. Keep `.fixed-loadout-icon-selector`,
`.fixed-loadout-trigger`, `.fixed-loadout-pairs`, `.fixed-loadout-pair`, and shared `.skill-bar-selected` rules needed
elsewhere. The wrappers have retained selector layout rules at `css/skill-bar.css:430–440`; responsive styling also
references the pair container (`css/page-layouts.css:534–536`). Wrapper consolidation is a separate layout change
requiring screenshots. Low-to-medium risk remains appropriate. Verify legend choices and specialization-disabled
options, search/focus, narrow/desktop/embed layouts, and palette/skill-damage children. UI-004 must be tested
independently.

### UI-003 — Earlier health-chart declarations are shadowed property by property

**Disposition: confirmed. Classification: cleanup / redundant CSS declarations. Severity: low. Confidence: high.**

PostCSS inspection independently identifies the nine claimed earlier declarations and their unconditional replacements.
Both rules in every row are top-level rules in `css/benchmarks.css`, use the exact same selector, and contain no
`!important`. The stylesheet is loaded at `css/style.css:22`.

| Exact selector                         | Earlier declaration in `css/benchmarks.css`                                                           | Later declaration in `css/benchmarks.css`                                             |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `.health-chart-layout`                 | `1021`: `grid-template-rows: minmax(var(--health-label-min-height, 360px), calc(100vh - 370px)) auto` | `1322`: `grid-template-rows: minmax(var(--health-label-min-height, 360px), 1fr) 20px` |
| `.health-chart-layout.has-health-pins` | `1024`: `grid-template-columns: 64px minmax(280px, 1fr) 230px`                                        | `1325`: `grid-template-columns: 58px minmax(230px, 1fr) 195px`                        |
| `.health-chart-layout.has-health-pins` | `1025`: `min-width: 610px`                                                                            | `1326`: `min-width: 530px`                                                            |
| `.health-values`                       | `1088`: `margin-top: 24px`                                                                            | `1335`: `margin: 0`                                                                   |
| `.health-table-scroll`                 | `1095`: `margin-top: 12px`                                                                            | `1364`: `margin-top: 0`                                                               |
| `.health-table-scroll`                 | `1094`: `overflow-x: auto`                                                                            | `1366`: `overflow: auto`                                                              |
| `.health-values :is(th, td)`           | `1102`: `padding: 8px`                                                                                | `1376`: `padding: 10px 6px`                                                           |
| `.health-values th:first-child`        | `1110`: `min-width: 180px`                                                                            | `1380`: `min-width: 150px`                                                            |
| `.health-pin-status`                   | `1075`: `margin-top: 8px`                                                                             | `1385`: `margin: 0`                                                                   |

**Expected behavior and impact:** retain one effective base value for each property. These redundant values make
maintenance misleading; they are not a rendering defect. The health chart is live markup in
`js/games/gw2/app/page/benchmark-dashboard.ts:412–417`, and the pinned state/label height is dynamic in
`js/games/gw2/app/page/benchmark-health-interactions.ts:30–54,92–99`. A missing literal state in an HTML template would
not make these selectors dead.

**Counterexamples to broad cleanup:** the early `.health-chart-scroll { padding: 8px 0; }`
(`css/benchmarks.css:1015–1019`) is only partly overridden by `padding-top: 12px` (`1313–1318`): bottom and horizontal
padding remain effective. Preserve it. Earlier `.health-values` color/font size (`1089–1090`), `.health-table-scroll`
max-width (`1093`), table-cell border/alignment/weight/whitespace (`1103–1106`), and first-column alignment/whitespace
(`1109,1111`) remain necessary. The later `@container benchmark-main` block (`1445–1464`) and narrow-viewport
table/pinned-grid rules (`1529–1537`) are conditional and must remain. An exact-selector duplicate list alone would
erase valid complementary rules.

**Recommendation and risk:** the smallest justified patch deletes only the nine earlier declarations above, removing
newly empty blocks if appropriate. Preserve the remaining order; moving the surviving declarations across competing
selectors is a separate change. Risk is low for deletion because the later values are already the winners; the report
correctly avoids a measured speed claim. Before wider consolidation, compare actual computed styles/screenshots with and
without pins, below the container breakpoint and at narrow viewport width. This review verifies parse/cascade structure,
not computed browser layout or historical browser support fallbacks.

## Negative claims, unnumbered hypotheses, and coverage

| Initial report statement or hypothesis                                | Independent assessment and evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Status / limit                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| No whole stylesheet is justified for deletion                         | Independently parsed the import graph from `css/style.css` and `css/patch-preview.css`: all 24 CSS files are reachable. Entry links are in `templates/profession.html:8`, `index.html:11`, `benchmarks.html:11`, and `patch-preview.html:8`.                                                                                                                                                                                                                                                                                                                                                              | Supported as loading evidence. Loaded does not prove every declaration is effective.                                                                                                                                                                                                                                                                                                                                                       |
| Dynamic classes invalidate raw unused-selector guesses                | Independently located `sd-${row.status}` and golem parts (`js/games/gw2/app/build/panels/skill-damage.ts:400–405,452`), resource placement (`js/games/gw2/app/rotation/palette/view.ts:271`), proc families (`js/games/gw2/app/rotation/timeline/rows.ts:344–357`), log badges/sources (`js/ui/results/event-log.ts:226,490`), trait picks (`js/games/gw2/app/build/panels/traits.ts:120–121`), tome names (`js/games/gw2/professions/guardian/specializations/firebrand/presentation.ts:102`), and artifact groups (`js/games/gw2/professions/thief/specializations/antiquary/presentation.ts:151–160`). | Supports retaining these families. The original count of 51 candidates is an initial-audit inventory result, not independently rederived here or a proof that all CSS is live.                                                                                                                                                                                                                                                             |
| Apparent unreferenced frontend module/export are used by tooling      | `scripts/build/benchmark-previews.mjs:30–32` loads `js/games/gw2/app/page/benchmark-preview-generation.ts` with `ssrLoadModule`; `scripts/analysis/capture-supported-build-metrics.mjs:22,119` imports/calls `targetHealthBandDps`.                                                                                                                                                                                                                                                                                                                                                                       | Both counterexamples independently verified. No justification for deleting these items. The complete 180-module/1,600-module scan was not repeated.                                                                                                                                                                                                                                                                                        |
| Skill-damage interaction can replace its focused subtree              | `renderSkillDamage` replaces the disclosure/body (`js/games/gw2/app/build/panels/skill-damage.ts:102–120`); disclosure toggle reruns it (`178–193`); row/filter actions rerender table regions (`195–216`).                                                                                                                                                                                                                                                                                                                                                                                               | Plausible, unconfirmed hypothesis. Important limit: worker completion calls `renderRegions`, which preserves assumption controls but replaces table content (`86–98,123–165`). Thus a claim that every completion loses every input's focus would be false. Scroll restoration already exists at `161–165`; actual anchoring/focus behavior still needs a browser.                                                                         |
| Settings `aria-modal` needs semantic review                           | `toggleAttribute('aria-modal', state.configOpen)` is present at `js/browser/shell/rotation-workspace.ts:102`. Standalone opening focuses the close button (`136–149`); embedded mode replaces the panel with a native dialog (`254–261`) and uses the dialog-opening helper (`103–110`).                                                                                                                                                                                                                                                                                                                  | Preserve as unresolved accessibility-semantics question. Empty attribute production is source-backed; native embedded modality and standalone focus/background semantics differ. A blanket replacement with `aria-modal="true"` is not established as correct. No accessibility-tree inspection performed.                                                                                                                                 |
| Old chart observer teardown might leak                                | Same-container remount disconnects via `ACTIVE_MOUNTS` (`js/games/gw2/app/results/charts/time-series-view.ts:643–646`); fresh section mounts replace contents and create a new chart host (`js/ui/results/simulation-view.ts:21–24`; `js/games/gw2/app/results/charts/section-view.ts:40–51`). Observer creation is at `js/games/gw2/app/results/charts/time-series-view.ts:973–984`; tokens guard old mounts only for the same container (`js/games/gw2/app/results/charts/time-series-view.ts:703,955`).                                                                                                | Lifecycle gap is plausible but neither retained objects nor a leak was measured. `ACTIVE_MOUNTS` is a WeakMap (`js/games/gw2/app/results/charts/time-series-view.ts:103–106`), so its existence alone is not proof of retention. The health-chart owner explicitly disconnects/reobserves on layout replacement (`js/games/gw2/app/page/benchmark-health-interactions.ts:81,92–99`). Keep the hypothesis separate from confirmed findings. |
| No state-framework rewrite or deletion is justified by these findings | The reviewed paths use explicit DOM ownership and native profession contracts. `docs/architecture/MODULES.md:166–191` documents existing build/loadout/preview boundaries and agrees with the traced consumers.                                                                                                                                                                                                                                                                                                                                                                                           | Agree with the restrained recommendation. This is not certification of every revision/cache/worker path, nor an exhaustive absence-of-bugs claim.                                                                                                                                                                                                                                                                                          |

No additional `UI-R...` discovery was raised. Existing unnumbered hypotheses were assessed without silently promoting
them. This review did not independently repeat the supplied historical issue inventory search; “no matching issue
established” remains limited to the initial auditor's stated inventory, not a claim that no issue exists.

## Methods, actual results, and remaining gaps

Read the audit brief, applicable README/script/test conventions, architecture and module ownership guidance, and
platform ownership README. Used source reads and `rg` searches across templates, Vite configuration, CSS, relevant
application/neutral UI renderers, profession presentation producers, and existing browser tests. The frozen report
provided questions to investigate, not evidence for the conclusions.

| Executed diagnostic                                       | Actual result                                                                                                                                                                                       |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node .scratch/audit/ui-review/contracts.mjs` (fixture A) | Exit 0. Eighteen actual transform checks; built-page option agreement; attribute control prelude and real recalculation; default and five Revenant specialization contexts; nine declaration pairs. |
| `node .scratch/audit/ui-review/keyboard.mjs` (fixture B)  | Exit 0. Five real-adapter commit handlers changed build state. Shared helper ArrowDown/Escape routing verified; search-input Enter restores replacement focus only for Utility.                     |
| Node/PostCSS recursive import walk (fixture C)            | Exit 0. All 24 stylesheets parsed and reachable from the two stylesheet entry points.                                                                                                               |
| Explicit report formatting/check                          | `npx prettier --write --ignore-path .gitignore docs/audits/2026-10-07/02-frontend-cleanup-review.md`, followed by the same path with `--check`.                                                     |

All three JavaScript blocks were extracted from the formatted review and executed successfully (exit 0). The
touched-file Prettier check passed. The original report's SHA-256 remained
`c338d28650728e398a6618bd62de52ff3cb866b8b76db0328d12fd5cd73c571c`, matching the frozen inventory.

The coordinator's baseline `npm run check` result (4,876 Node tests plus its other stages) was supplied as shared
context, not rerun or represented as a new reviewer result. These new fixtures intentionally use the already-built
compiled modules. No clean/build, install, browser-installer retry, source/test/config edit, commit, or push was
performed.

No functional browser is available: Chrome installation was blocked by privileges and prior Chromium downloads were
invalid. Native focus defaults, option default activation, keyboard Tab order, tooltip interaction, accessibility-tree
semantics, computed CSS, screenshots, responsive/container/embed behavior, and observer lifetime/heap retention remain
unexecuted. The fake elements deliberately record explicit method calls and markup; they do not establish those browser
results. No screen-reader, network, performance, or exhaustive specialization/legend-pair matrix is claimed. The
source-level findings and narrow cleanup boundaries are sufficiently supported without claiming that missing coverage
passed.

## Reproducible reviewer fixtures

Save each code block at the named scratch path and run its command from the repository root using the existing baseline
build. These files are disposable diagnostics; the complete executable logic is included here because scratch files are
not committed. The control prelude in fixture A intentionally stops at `renderAttributes`' missing-attribute-data guard
after testing only its selector synchronization. Fixture B's `changed` stub invokes the real Skills renderer but does
not construct the entire application or implement browser focus removal.

### Fixture A — `.scratch/audit/ui-review/contracts.mjs`

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import config from '../../../vite.config.js';
import postcss from 'postcss';
import { renderAttributes } from '#gw2/app/build/panels/attributes.js';
import { renderSkills } from '#gw2/app/build/panels/skills.js';
import { elementalistAppAdapter as ele } from '#gw2/professions/elementalist/app/app-definition.js';
import { revenantAppAdapter as rev } from '#gw2/professions/revenant/app/app-definition.js';
const ids = ['elementalist', 'engineer', 'guardian', 'mesmer', 'necromancer', 'ranger', 'revenant', 'thief', 'warrior'];
for (const command of ['serve', 'build']) {
  const plugin = config({ command, mode: 'production' }).plugins.find((p) => p.name === 'render-profession-pages');
  for (const id of ids) {
    const raw = plugin.transformIndexHtml.handler(fs.readFileSync(`${id}.html`, 'utf8'), { filename: `${id}.html` });
    const built = fs.readFileSync(`dist/site/${id}.html`, 'utf8');
    const options = (html) =>
      [
        ...html.match(/<select\b[^>]*id="attribute-weapon-set"[^>]*>([\s\S]*?)<\/select>/)[1].matchAll(/value="(\d)"/g)
      ].map((m) => m[1]);
    assert.deepEqual(options(raw), id === 'elementalist' ? ['1'] : ['1', '2']);
    assert.deepEqual(options(raw), options(built));
  }
}
console.log('UI-001 actual transform and built HTML: 18 checks; Elementalist [1], other eight [1,2]');
class Select {
  disabled = false;
  value = '';
  hidden = false;
  closest() {
    return {
      toggleAttribute: (_key, value) => {
        this.hidden = value;
      }
    };
  }
}
globalThis.HTMLSelectElement = Select;
globalThis.HTMLInputElement = class {};
const select = new Select();
globalThis.document = { getElementById: () => select };
for (const alternate of [
  ['Staff', ''],
  ['', '']
]) {
  const app = { build: { alternateWeapons: alternate }, attributeWeaponSet: 2 };
  assert.throws(() => renderAttributes(app), /Profession attributes must exist/);
  assert.equal(select.disabled, !alternate[0]);
  assert.equal(select.hidden, !alternate[0]);
  assert.equal(select.value, alternate[0] ? '2' : '1');
  console.log(
    'UI-001 control prelude',
    JSON.stringify({ alternate, disabled: select.disabled, hidden: select.hidden, value: select.value })
  );
}
const catalog = ele.profession.catalog,
  build = ele.profession.createBuildDefaults();
build.alternateWeapons = ['Staff', ''];
build.alternateWeaponPrefixes = ["Minstrel's", "Minstrel's"];
const app = {
  adapter: ele,
  profession: ele.profession,
  activeCatalog: catalog,
  skillById: catalog.skillsById,
  skillByName: catalog.skillsByName,
  skills: [...catalog.skills],
  weaponData: ele.weaponData,
  build,
  patchId: 'current',
  results: null
};
const powers = [];
for (const set of [1, 2]) {
  app.attributeWeaponSet = set;
  ele.recalculate(app);
  powers.push(app.attributeData.attributes.Power.final);
}
assert.notEqual(...powers);
console.log('UI-001 recalculated powers', powers);
const host = {
  innerHTML: '',
  classList: { remove() {} },
  querySelectorAll: () => [],
  parentElement: { querySelector: () => ({}) }
};
globalThis.document = { getElementById: () => host };
const rbuild = rev.profession.createBuildDefaults();
renderSkills({
  adapter: rev,
  profession: rev.profession,
  build: rbuild,
  activeCatalog: rev.profession.catalog,
  skillById: rev.profession.catalog.skillsById,
  patchId: 'current',
  results: null
});
assert.equal((host.innerHTML.match(/class="fixed-loadout-skill-stack"/g) || []).length, 10);
assert.equal((host.innerHTML.match(/class="skill-bar-slot fixed-loadout-skill/g) || []).length, 15);
console.log('UI-002 default Herald: 10 root stacks, 15 total tiles, two selectors/two bars');
for (const specialization of ['Core', 'Herald', 'Renegade', 'Vindicator', 'Conduit']) {
  rbuild.specializations[2].name = specialization === 'Core' ? 'Retribution' : specialization;
  const rcat = rev.profession.catalog;
  const ctx = { build: rbuild, specialization: rev.eliteSpecialization(rbuild), catalog: rcat };
  const choices = rev.slotLoadout.view(ctx).selectors[0].options.filter((o) => !o.disabled);
  rbuild.selectedLegends = choices.slice(0, 2).map((o) => o.value);
  renderSkills({
    adapter: rev,
    profession: rev.profession,
    build: rbuild,
    activeCatalog: rcat,
    skillById: rcat.skillsById,
    patchId: 'current',
    results: null
  });
  const counts = {
    bars: (host.innerHTML.match(/class="fixed-loadout-bar /g) || []).length,
    selectors: (host.innerHTML.match(/data-loadout-toggle/g) || []).length,
    tiles: (host.innerHTML.match(/class="skill-bar-slot fixed-loadout-skill/g) || []).length
  };
  assert.equal(counts.bars, 2);
  assert.equal(counts.selectors, 2);
  assert.ok(counts.tiles >= 10);
  console.log('UI-002', specialization, counts);
}
const root = postcss.parse(fs.readFileSync('css/benchmarks.css', 'utf8'));
const pairs = [
  ['.health-chart-layout', 'grid-template-rows', 'grid-template-rows'],
  ['.health-chart-layout.has-health-pins', 'grid-template-columns', 'grid-template-columns'],
  ['.health-chart-layout.has-health-pins', 'min-width', 'min-width'],
  ['.health-values', 'margin-top', 'margin'],
  ['.health-table-scroll', 'margin-top', 'margin-top'],
  ['.health-table-scroll', 'overflow-x', 'overflow'],
  ['.health-values :is(th, td)', 'padding', 'padding'],
  ['.health-values th:first-child', 'min-width', 'min-width'],
  ['.health-pin-status', 'margin-top', 'margin']
];
for (const [selector, oldProp, newProp] of pairs) {
  const rules = root.nodes.filter((r) => r.type === 'rule' && r.selector === selector);
  assert.equal(rules.length, 2);
  const old = rules[0].nodes.find((d) => d.prop === oldProp),
    later = rules[1].nodes.find((d) => d.prop === newProp);
  assert.ok(old && later && !old.important && !later.important);
  console.log(
    'UI-003',
    selector,
    `${old.source.start.line} ${oldProp}:${old.value} -> ${later.source.start.line} ${newProp}:${later.value}`
  );
}
console.log('All independent source/markup/control/cascade assertions passed.');
```

### Fixture B — `.scratch/audit/ui-review/keyboard.mjs`

```js
import assert from 'node:assert/strict';
import { renderSkills } from '#gw2/app/build/panels/skills.js';
import { bindDropdownSearch } from '#ui/shared/dropdown-search.js';
import { rangerAppAdapter as ranger } from '#gw2/professions/ranger/app/app-definition.js';
import { engineerAppAdapter as engineer } from '#gw2/professions/engineer/app/app-definition.js';
import { revenantAppAdapter as revenant } from '#gw2/professions/revenant/app/app-definition.js';
let events = [];
class El {
  constructor(name, dataset = {}) {
    this.name = name;
    this.dataset = dataset;
    this.listeners = {};
    this.childNodes = [];
    this.hidden = false;
    this.value = '';
    this.textContent = 'Choice';
    this.classList = { add() {}, remove() {}, toggle() {} };
  }
  addEventListener(type, fn) {
    (this.listeners[type] ??= []).push(fn);
  }
  fire(type, data = {}) {
    const e = { target: this, preventDefault() {}, stopPropagation() {}, ...data };
    for (const fn of this.listeners[type] || []) fn(e);
  }
  click() {
    this.fire('click');
  }
  focus() {
    events.push(`focus:${this.name}`);
    document.activeElement = this;
  }
  matches() {
    return false;
  }
  setAttribute() {}
  append(...items) {
    this.childNodes.push(...items);
  }
  querySelectorAll() {
    return [];
  }
  checkVisibility() {
    return this.open ?? false;
  }
}
globalThis.HTMLElement = El;
globalThis.HTMLButtonElement = El;
globalThis.HTMLSelectElement = class extends El {};
globalThis.Node = El;
for (const kind of ['utility', 'pet', 'hammer', 'morph', 'legend']) {
  const adapter = kind === 'morph' ? engineer : kind === 'legend' ? revenant : ranger;
  const build = adapter.profession.createBuildDefaults();
  if (kind === 'morph') build.specializations[2].name = 'Amalgam';
  const catalog = adapter.profession.catalog;
  const app = {
    adapter,
    profession: adapter.profession,
    build,
    activeCatalog: catalog,
    skillById: catalog.skillsById,
    skillByName: catalog.skillsByName,
    skills: [...catalog.skills],
    patchId: 'current',
    results: null,
    changed() {
      events.push('changed');
      renderSkills(app);
    }
  };
  const slot = new El('slot'),
    option = new El('option');
  let selectMode = 'special';
  if (kind === 'utility') {
    selectMode = 'ordinary';
    slot.dataset.key = 'Utility1';
    option.dataset.skillId = String(build.selectedSkillIds.Utility2);
  } else if (kind === 'legend') {
    selectMode = 'legend';
    const ctx = { build, catalog, specialization: adapter.eliteSpecialization(build) };
    const sel = adapter.slotLoadout.view(ctx).selectors[0];
    option.dataset = {
      loadoutKey: sel.key,
      loadoutValue: sel.options.find((o) => !o.disabled && o.value !== sel.value).value
    };
  } else {
    const groups = adapter.profession.ui.skillBarGroups({
      build,
      catalog,
      specialization: adapter.eliteSpecialization(build)
    });
    const key = kind === 'pet' ? 'selectedPet' : kind === 'hammer' ? 'selectedHammerSkillIds' : 'selectedMorphSkillIds';
    const sel = groups.flatMap((g) => g.selections || []).find((s) => s.selectionKey === key);
    assert.ok(sel, kind);
    slot.dataset = { selectionKey: sel.selectionKey, selectionIndex: String(sel.selectionIndex) };
    const entry = sel.optionEntries?.find((o) => String(o.value) !== String(sel.selectionValue));
    const skillId = entry?.skillId ?? sel.optionSkillIds?.find((id) => id !== sel.skillId);
    option.dataset = {
      ...(entry ? { selectionValue: String(entry.value) } : {}),
      ...(skillId == null ? {} : { skillId: String(skillId) })
    };
  }
  slot.querySelectorAll = () => [option];
  const replacement = new El('replacement');
  let first = true;
  const host = new El('host');
  host.parentElement = { querySelector: () => ({}) };
  host.querySelector = () => replacement;
  host.querySelectorAll = (selector) => {
    if (!first) return [];
    if (selectMode === 'ordinary' && selector === '.skill-bar-slot[data-key]') return [slot];
    if (selectMode === 'special' && selector === '.skill-bar-inspection-slot[data-selection-key]') return [slot];
    if (selectMode === 'legend' && selector === 'button[data-loadout-key]') return [option];
    return [];
  };
  globalThis.document = { getElementById: () => host, querySelector: () => null, createElement: (tag) => new El(tag) };
  renderSkills(app);
  first = false;
  const trigger = new El('trigger'),
    menu = new El('menu');
  menu.childNodes = [option];
  menu.querySelectorAll = (s) => (s === '.dd-item' ? [option] : []);
  bindDropdownSearch(
    trigger,
    menu,
    '.dd-item',
    () => (menu.open = true),
    () => (menu.open = false),
    'Choose'
  );
  trigger.fire('click', { detail: 0 });
  const input = menu.childNodes.find((e) => e.name === 'input');
  assert.ok(input);
  assert.equal(document.activeElement, input);
  menu.fire('keydown', { target: input, key: 'ArrowDown' });
  assert.equal(document.activeElement, option);
  menu.fire('keydown', { target: option, key: 'Escape' });
  assert.equal(document.activeElement, trigger);
  events = [];
  const before = JSON.stringify(build);
  trigger.fire('click', { detail: 0 });
  menu.fire('keydown', { target: input, key: 'Enter' });
  assert.ok(events.includes('changed'));
  assert.notEqual(JSON.stringify(build), before, kind + ' must change the real build');
  assert.equal(events.includes('focus:replacement'), kind === 'utility');
  console.log(kind, JSON.stringify(events));
}
console.log(
  'Five real-adapter selection handlers + actual dropdown search-input Enter/ArrowDown/Escape paths passed. Focus events only; no native browser focus/default-action simulation.'
);
```

### Fixture C — recursive stylesheet import check

Run with `node --input-type=module` from the repository root:

```js
import fs from 'node:fs';
import postcss from 'postcss';
import assert from 'node:assert/strict';
const files = fs.readdirSync('css').filter((f) => f.endsWith('.css'));
const visited = new Set();
function visit(name) {
  if (visited.has(name)) return;
  visited.add(name);
  const root = postcss.parse(fs.readFileSync(`css/${name}`, 'utf8'));
  root.walkAtRules('import', (rule) => {
    const next = rule.params.match(/\.\/([^'"\)]+)/)?.[1];
    if (next) visit(next);
  });
}
visit('style.css');
visit('patch-preview.css');
assert.deepEqual([...visited].sort(), files.sort());
console.log(`Stylesheets: parsed/import reachable ${visited.size}/${files.length}`);
```
