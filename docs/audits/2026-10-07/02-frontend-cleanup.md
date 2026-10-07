# Frontend cleanup audit

Baseline: `061147ad40b62f032fb2f0da41f2dd4d9807eee3` (2026-10-07).

Status: initial audit in progress. Findings below are source-backed; browser reproduction remains unavailable. The application uses TypeScript and imperative DOM rendering, not React. No production changes were made.

## Correctness findings

### UI-001 — Elementalist cannot select its second equipment set in Attribute Preview

- **Classification:** bug / obsolete template condition. **Severity:** medium. **Confidence:** high.
- **Baseline locations:** `vite.config.js:23–28,89–95` (`professionPages.elementalist.singleWeaponSet` and `renderProfessionPages` substitutions); `templates/profession.html:175–182`; `js/games/gw2/app/build/panels/attributes.ts:20–26` (`renderAttributes`); `js/games/gw2/app/build/panels/gear.ts:224–227`; `js/games/gw2/app/session-controls.ts:16–22`.
- **Expected:** Attribute Preview can inspect either equipped weapon set independently of combat swap availability. This is explicitly the contract in `renderAttributes`; the equipment editor renders both sets for every profession.
- **Observed:** Elementalist alone has `singleWeaponSet: true`. The build transform removes its `<option value="2">`, even though `renderAttributes` subsequently reveals and enables the selector when `alternateWeapons[0]` exists. Runtime rendering changes the selected value and visibility, but never inserts an option. The existing built `dist/site/elementalist.html` contains only option `1`; Engineer and Guardian contain both `1` and `2`.
- **Trigger/impact:** equip an alternate Elementalist weapon set with different prefixes/sigils, then try to inspect its attributes. The visible selector offers only set 1. This concerns preview controls, not permission to swap during combat.
- **Reproduction:** open `/elementalist.html#workspace`, equip Weapon set 2, inspect `#attribute-weapon-set` options. Artifact diagnostic (executed against the coordinator's baseline build):

  ```js
  import fs from 'node:fs';
  for (const id of ['elementalist', 'engineer', 'guardian']) {
    const html = fs.readFileSync(`dist/site/${id}.html`, 'utf8');
    console.log(id, html.match(/<select\b[^>]*id="attribute-weapon-set"[^>]*>([\s\S]*?)<\/select>/)[1]);
  }
  ```

  Result: Elementalist has `<option value="1">1</option>` only; the two controls also contain `<option value="2">2</option>`. No browser interaction was claimed.
- **Smallest recommendation:** always emit both Attribute Preview options and let `renderAttributes` own whether a second equipped set exists. Remove only the option/visibility template coupling; do not remove Elementalist's distinct theme handling just because it shares the `singleWeaponSet` flag.
- **Risk/validation:** low implementation risk. Add the Elementalist case to `tests/browser/buffed-attributes.spec.js`: equip distinct alternate gear, select 2, verify preview attributes and preservation of preview inputs; remove alternate gear and verify selection returns to 1. Keep combat swap restrictions unchanged. Existing preview browser tests exercise Mesmer and do not cover this template branch.
- **Related:** no matching issue established in supplied issue inventory; no external game-mechanics claim required.

## Cleanup findings

### UI-002 — Stop constructing the permanently hidden Revenant fixed skill bars

- **Classification:** cleanup (unnecessary rendering, not dead selectors). **Severity:** low. **Confidence:** high.
- **Baseline locations:** `js/games/gw2/app/build/panels/skills.ts:275–330,374–392` (`renderFixedSlotLoadout`, `slotHtml`, `barSkillHtml`, `barHtml`); `css/build-editor.css:1430–1437`; `css/skill-bar.css:409–428,443–428` (see detailed final line inventory below); `templates/profession.html:82–86`.
- **Expected:** the build area provides editable legend selectors; fixed skills are already available in the rotation palette. The CSS comment states this intent explicitly.
- **Observed:** every shipped Revenant workspace places `#skill-bar` under `.workspace-build-choices`. The unconditional, profession-specific rule sets every `.fixed-loadout-bar` to `display: none`. Nevertheless each `renderSkills` constructs root skill tiles, child chains, images, tabindex attributes, and simulation tooltip metadata before inserting those bars. No production script reveals them; all additional matching bar CSS is less specific and has no `!important` display override. This is executed hidden rendering, not unreachable code.
- **Trigger/impact:** startup and static build refreshes on Revenant generate invisible duplicated skill content and retain its CSS/renderer complexity. No timing or user-perceived speed claim is made.
- **Focused diagnostic:** invoked the actual compiled `renderSkills` with the real Revenant adapter/default build and an inert markup-capture host. It emitted **2 bars, 15 fixed skill tiles, 2 legend selectors**, and 27 tooltip attribute sets. The fixture deliberately does not emulate layout; invisibility follows from the shipped template/cascade trace.
- **Smallest recommendation:** render only the two legend selectors in this build area and remove the now-unneeded local bar/child markup plus CSS exclusively styling that removed subtree. Keep selector wrappers if necessary to preserve their existing layout. Keep `slotLoadout.view().bars`, `skillChildren`, and the profession loadout contract: `rotation/palette/model.ts:821` and `build/skill-damage/plan.ts:217` consume them independently. Do not remove the domain model as “unused.”
- **Risk/validation:** low-to-medium because broad `.skill-bar-selected` styles and `.fixed-loadout-pairs` responsive layout also serve retained selectors. Verify Revenant legends, disabled elite options, keyboard search and focus, palette flips/children, and desktop/narrow/embedded layouts. Run focused Revenant loadout and skill-damage contracts; require screenshots before deleting layout wrappers. Keep game mechanics and palette contents unchanged.
- **Related:** UI-004 focus investigation (pending numbering); no matching known issue established.

### UI-003 — Delete shadowed health-chart declarations instead of retaining two base layouts

- **Classification:** cleanup / redundant CSS declarations. **Severity:** low. **Confidence:** high.
- **Baseline locations:** `css/benchmarks.css:1015–1026,1073–1111` and overriding blocks at `1313–1338,1363–1387`; loaded by `css/style.css:22`. Both sets are unconditional rules in the same stylesheet and cascade layer.
- **Expected:** one readable base declaration per property, with responsive overrides where required.
- **Observed:** earlier values are always superseded by later rules with exactly the same selector/specificity, including `.health-chart-layout` `grid-template-rows`, `.health-chart-layout.has-health-pins` `grid-template-columns` and `min-width`, `.health-values` `margin-top` (later `margin: 0`), `.health-table-scroll` `margin-top` and `overflow-x` (later `overflow: auto`), `.health-values :is(th, td)` `padding`, `.health-values th:first-child` `min-width`, and `.health-pin-status` `margin-top` (later `margin: 0`). These are redundant declarations, not dead selectors: the chart and table are active UI.
- **Trigger/impact:** every health-chart render loads both generations of base layout. Edits to the earlier values have no effect, increasing maintenance ambiguity. No runtime performance gain is asserted.
- **Reproduction/method:** parsed all 24 stylesheets with the installed PostCSS parser, grouping identical selectors by their complete at-rule ancestry; inspected each duplicate and intervening/responsive rules. The listed later declarations are unconditional and use supported values already required by the UI. Media/container rules remain separate and must not be flattened.
- **Smallest recommendation:** remove only the listed earlier shadowed declarations first. Optionally consolidate their remaining base properties in a later follow-up while preserving cascade order; do not mass-deduplicate by selector name.
- **Risk/validation:** low for deletion of earlier declarations; higher for moving blocks relative to competing selectors. Compare computed styles/screenshots for Health view with/without pinned labels, narrow container stacking, and small viewport horizontal scrolling. Preserve the later responsive rules at `1445` onward.
- **Related:** UI-002 is a separate hidden-markup cleanup; no matching known issue established.

## Coverage inventory and focused validation

In progress. Read project README, architecture/module ownership documents, platform README, and script/test contribution conventions. Coordinator reports baseline `npm run check` passed (4,876 Node tests); broad checks were not repeated.

Browser limitation: Chrome is absent; coordinator's system installation was blocked by package-manager privileges, and user-space Chromium downloads were invalid/truncated. No browser/layout/focus assertions were executed. Source traces and inert DOM fixtures are explicitly distinguished from real browser verification.

## Hypotheses and remaining gaps

- Specialized build selectors and skill-damage disclosure/filter handlers replace the focused subtree without restoring focus; investigating source-backed keyboard impact.
- The settings controller uses `toggleAttribute('aria-modal', state.configOpen)` rather than a boolean ARIA token; investigating intended standalone versus embedded modality.
- No selector is called dead solely because its literal name is absent. Dynamic selector analysis and negative results will be completed in the final inventory.
