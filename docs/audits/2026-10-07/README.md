# Repository audit — 2026-10-07

Completed documentation-only audit of `Kadenar/gw2-combat-simulator` at `061147ad40b62f032fb2f0da41f2dd4d9807eee3`. Five
initial audits and five fresh independent reviews produced **21 original findings: 13 confirmed and eight confirmed with
corrections**. Two additional reviewer discoveries were independently validated by the coordinator. All 23 entries are
retained below. None of the original findings is wholly rejected or unresolved, but rejected subclaims and unverified
hypotheses remain explicit in the reviews.

This change contains only these eleven Markdown documents. It implements no production fixes, refactors, tests, or
configuration changes. Read the review alongside each original: the frozen originals deliberately retain claims and
recommendations that review narrowed or corrected. Final severity is medium for ten findings, low for twelve, and
informational for one; no high or critical severity is claimed.

## Reports

| Assignment                            | Frozen initial audit                                         | Independent review                                                         |
| ------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Profession organization and contracts | [01-profession-consistency.md](01-profession-consistency.md) | [01-profession-consistency-review.md](01-profession-consistency-review.md) |
| Frontend CSS and simplification       | [02-frontend-cleanup.md](02-frontend-cleanup.md)             | [02-frontend-cleanup-review.md](02-frontend-cleanup-review.md)             |
| Kernel correctness and architecture   | [03-kernel-audit.md](03-kernel-audit.md)                     | [03-kernel-audit-review.md](03-kernel-audit-review.md)                     |
| Platform and profession requirements  | [04-platform-audit.md](04-platform-audit.md)                 | [04-platform-audit-review.md](04-platform-audit-review.md)                 |
| General integration bugs              | [05-general-bugs.md](05-general-bugs.md)                     | [05-general-bugs-review.md](05-general-bugs-review.md)                     |

## Highest-impact confirmed findings

- **Stale results and rotation authoring:** BUG-001 leaves inactive tabs' Current and Reference results cached under
  changed shared transition settings. BUG-002 resolves legacy skill names against the full catalog instead of the
  selected specialization. BUG-003 can author the previous weapon's skill through consecutive swap/weapon hotkeys before
  the pending baseline settles. These are separate cache, codec, and planning-freshness defects.
- **Native simulation aborts:** KERNEL-001 admits a fractional-time Dodge before its endurance can be spent; KERNEL-003
  admits an overlapping Firebrand page-cost combination that fails at commit. The overlap fix must preserve explicitly
  supported Vindicator Dodge Jump plus autoattack behavior.
- **Ranger recharge:** PROF-003 snapshots Alacrity for autonomous pet recharge instead of accounting for subsequent
  changes. Reviewer discovery PROF-R001 demonstrates a separate identity leak: an outgoing pet's Alacrity speeds the
  replacement pet's commanded recharge even when the replacement has no Alacrity. Correct recipient/lifetime handling
  before extending the shared recharge path to more pet behavior.
- **Unavailable or inaccessible UI behavior:** BUG-R001 rejects Vindicator's synthetic Dodge + Auto tile despite ready
  constituent actions. UI-001 omits Elementalist's second Attribute Preview option despite supported alternate gear;
  UI-004 replaces focused profession selectors without restoring focus. Browser-level focus consequences remain
  unexecuted.

## Evidence baseline

- Repository: `Kadenar/gw2-combat-simulator`.
- Intended PR base: `main`.
- Audited source commit: `061147ad40b62f032fb2f0da41f2dd4d9807eee3` (`Improvements to simulation comparison`). All
  auditors and reviewers use this commit, regardless of later changes to `main`.
- Isolated audit branch: `audit/2026-10-07-repository-review`. Fresh clone; working tree was clean before audit
  documentation. No unrelated local edits were present.
- Budget began 2026-10-07 04:40:39 UTC (00:40:39 America/New_York); maximum deadline 12:40:39 UTC. Eight hours is a
  ceiling, not a minimum duration.
- GitHub connector authenticated as `Kadenar`; repository metadata reports push permission. Local configured Git
  identity is `Codex <codex@openai.com>`; no identity or credentials were fabricated or overridden.
- Runtime: Node `v24.19.0`, npm `11.9.0`. `npm ci` succeeded (109 packages).
- No applicable `AGENTS.md` or `CONTRIBUTING` files were found in the repository or parent workspace paths. Contribution
  conventions read in `scripts/README.md`, `tests/README.md`, architecture documents, platform README, and CI validation
  workflows.
- Known-issue check: 36 issue descriptions and 100 recently updated issue/PR records retrieved. This is not a complete
  historical PR audit. At retrieval, #66 (Impossible Odds) and #70 (Untamed ambush attacks) were open; many other
  descriptions were closed and require source verification before alleging a regression.

## Actual source owners

| Area                 | Baseline locations                                                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Professions          | `js/games/gw2/professions/`, registered in `js/games/gw2/profession-registry.ts`; nine professions, Core plus four elites each                       |
| Frontend             | `js/browser/`, `js/ui/`, `js/games/gw2/app/`, profession `app/` and presentation files, `css/`, root HTML, `templates/`                              |
| Game-neutral kernel  | Nine modules under `js/kernel/`                                                                                                                      |
| GW2 runtime/platform | `js/games/gw2/platform/`; simulation, execution, resolver, combat, effects, skills, builds, equipment, profession contracts, results and measurement |
| Integrations         | `js/games/gw2/integrations/`; logs, keybinds, patch previews                                                                                         |
| Validation           | `tests/`, npm scripts, `.github/actions/validate/action.yml`, build artifact validators                                                              |

Architecture and contract references include `docs/architecture/ARCHITECTURE.md`, `MODULES.md`, event-clock/ordering
documents, programmatic simulation documentation, profession documents, and `js/games/gw2/platform/README.md`. Current
source uses one simulation queue and clock. Constant player Quickness/Alacrity assumptions, full player health, and
omitted incoming damage are documented scope choices. Summon recharge is distinct:
`js/games/gw2/platform/combat/recharge.ts` integrates received Alacrity grants and expiry; the architecture document's
blanket statement about summons is stale.

## Validation

`npm run check` passed (exit 0): formatting, lint, production build, 4,876 Node tests (7 suites; 0 failures, skips,
cancellations or todos), typecheck, compiled-module and site validation. Node test duration was 59,680.748964 ms.
Artifact checks verified 1,599 TypeScript outputs with no source duplicates, 11 bundled pages, and two runtime asset
roots. Vite emitted its existing large-chunk advisory; no performance benchmark is inferred from it. npm warned about
the environment's `http-proxy` configuration.

Chrome was absent from inspected system locations. `npx playwright install chrome` failed (exit 1) because `apt-get`
could not change groups/users in this environment (`setgroups: Operation not permitted`). This is an environment
limitation, not a repository failure. Browser tests were not included in `npm run check`; subsequent logic diagnostics
are recorded in the reports.

A user-space fallback, `npx playwright install chromium`, also failed (exit 1): the downloaded Chrome for Testing
archives were empty/truncated or otherwise not valid ZIP files. No browser suite pass is claimed. Source traces and
Node/DOM fixtures can validate logic but cannot establish computed layout or real browser interactions.

## Agent execution

All five initial agents were explicitly spawned concurrently with model `gpt-6-astra` and reasoning effort `high`:
`audit_professions`, `audit_frontend`, `audit_kernel`, `audit_platform`, and `audit_bugs`. Each owns only its assigned
report. Agents were prohibited from spawning other agents or making Git mutations. The coordinator owns this summary and
Git operations. After all five originals were complete, five fresh agents were explicitly spawned with the same model
and effort: `review_professions`, `review_frontend`, `review_kernel`, `review_platform`, and `review_bugs`. No
additional agents were spawned. The eight-hour budget is a maximum; phases advance when their substantive work is
complete.

## Frozen initial reports

All five originals completed before any reviewer was spawned. They were frozen on 2026-10-07 at 05:07:57 UTC with **21
stable finding IDs**. Initial source-path/range checks and explicit touched-Markdown formatting checks passed. Initial
reports remain unchanged during review; corrections and rejections belong in the corresponding review and final
register.

| Initial report                                               | SHA-256 at freeze                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------------ |
| [01-profession-consistency.md](01-profession-consistency.md) | `ddd9945dd039ea0fc04eba6ba60c56f225f59215b9a0c2ea9ece44be0dbfc25b` |
| [02-frontend-cleanup.md](02-frontend-cleanup.md)             | `c338d28650728e398a6618bd62de52ff3cb866b8b76db0328d12fd5cd73c571c` |
| [03-kernel-audit.md](03-kernel-audit.md)                     | `44f50c48c27bc5e7e68b25ebe0854a8ac8d6afab00fbcdc7091271bbe9548d52` |
| [04-platform-audit.md](04-platform-audit.md)                 | `950f423ddb6ab2b3eef379b8aa49070c0bd5c8563abefe90bf04564936c41f69` |
| [05-general-bugs.md](05-general-bugs.md)                     | `8e2434f8ef713066002ce171577482a92e7aa8bae89000034b28de450820afca` |

## Consolidated finding register

Severity reflects demonstrated impact, separately from evidence confidence. “High” confidence here supports the bounded
claim in the review, not every original suggestion or an external live-game timing claim. Each original has one fresh
reviewer; the two `R001` entries were discovered by reviewers and additionally checked by the coordinator. This register
uses one primary classification where reports discuss multiple aspects.

| ID           | Finding                                                            | Classification              | Final severity | Confidence                                                  | Review disposition                           | Evidence                                                                             |
| ------------ | ------------------------------------------------------------------ | --------------------------- | -------------- | ----------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------ |
| PROF-001     | Natural Fortitude runtime modifier belongs to Untamed, not Druid   | Bug                         | Low            | High; raw-config runtime query scope                        | Confirmed                                    | [Audit](01-profession-consistency.md), [review](01-profession-consistency-review.md) |
| PROF-002     | Programmatic documentation calls nonexistent `resolveRuntime`      | Cleanup                     | Low            | High                                                        | Confirmed                                    | [Audit](01-profession-consistency.md), [review](01-profession-consistency-review.md) |
| PROF-003     | Autonomous pet recharge snapshots Alacrity                         | Bug                         | Medium         | High for internal contract; external timing unverified      | Confirmed with corrections                   | [Audit](01-profession-consistency.md), [review](01-profession-consistency-review.md) |
| PROF-004     | Static Initiative costs duplicate shared activation-cost lifecycle | Architectural inconsistency | Low            | High for duplication; medium for migration benefit          | Confirmed with corrections                   | [Audit](01-profession-consistency.md), [review](01-profession-consistency-review.md) |
| UI-001       | Elementalist lacks second Attribute Preview weapon option          | Bug                         | Medium         | High                                                        | Confirmed                                    | [Audit](02-frontend-cleanup.md), [review](02-frontend-cleanup-review.md)             |
| UI-002       | Revenant renders fixed skill bars hidden by shipped CSS            | Cleanup                     | Low            | High for shipped markup/cascade                             | Confirmed                                    | [Audit](02-frontend-cleanup.md), [review](02-frontend-cleanup-review.md)             |
| UI-003       | Nine health-chart declarations are unconditionally shadowed        | Cleanup                     | Low            | High                                                        | Confirmed                                    | [Audit](02-frontend-cleanup.md), [review](02-frontend-cleanup-review.md)             |
| UI-004       | Profession selector rebuilds omit focus restoration                | Bug                         | Medium         | High for source defect; browser aftermath unverified        | Confirmed with corrections                   | [Audit](02-frontend-cleanup.md), [review](02-frontend-cleanup-review.md)             |
| KERNEL-001   | Cost admission and spending tolerances disagree                    | Bug                         | Medium         | High; native fractional-wait reproduction                   | Confirmed                                    | [Audit](03-kernel-audit.md), [review](03-kernel-audit-review.md)                     |
| KERNEL-002   | Initial queue entries skip the preparation hook                    | Bug                         | Low            | High; extension contract, not current coordinator failure   | Confirmed                                    | [Audit](03-kernel-audit.md), [review](03-kernel-audit-review.md)                     |
| KERNEL-003   | Concurrent admission can overcommit Firebrand pages                | Bug                         | Medium         | High                                                        | Confirmed with corrections                   | [Audit](03-kernel-audit.md), [review](03-kernel-audit-review.md)                     |
| KERNEL-004   | Boon replay ignores executed priority when reordering ties         | Bug                         | Low            | High; packet fixture, native rotation impact unproven       | Confirmed                                    | [Audit](03-kernel-audit.md), [review](03-kernel-audit-review.md)                     |
| KERNEL-005   | No Quarter extension is missing from executed facts                | Bug                         | Low            | High; live pool and reported timeline diverge               | Confirmed                                    | [Audit](03-kernel-audit.md), [review](03-kernel-audit-review.md)                     |
| KERNEL-006   | Horizon helper/documentation and runtime disagree on tolerance     | Architectural inconsistency | Low            | High for disagreement; policy choice remains                | Confirmed                                    | [Audit](03-kernel-audit.md), [review](03-kernel-audit-review.md)                     |
| KERNEL-007   | Eager packet expansion precedes the outer event budget             | Performance concern         | Low            | High for bounded reproduction; no benchmark claim           | Confirmed with corrections                   | [Audit](03-kernel-audit.md), [review](03-kernel-audit-review.md)                     |
| PLATFORM-001 | Occurrence enumeration omits numeric-string trait IDs              | Bug                         | Low            | High; direct/custom configuration scope                     | Confirmed with corrections                   | [Audit](04-platform-audit.md), [review](04-platform-audit-review.md)                 |
| PLATFORM-002 | Specialization accessor exposes mutable state to readonly queries  | Architectural inconsistency | Low            | High for type capability; no observed production corruption | Confirmed                                    | [Audit](04-platform-audit.md), [review](04-platform-audit-review.md)                 |
| PLATFORM-003 | Completion-tail scheduling repeats an existing ordering relation   | Cleanup                     | Informational  | High; optional convenience                                  | Confirmed with corrections                   | [Audit](04-platform-audit.md), [review](04-platform-audit-review.md)                 |
| BUG-001      | Shared settings leave inactive Current/Reference caches reusable   | Bug                         | Medium         | High                                                        | Confirmed                                    | [Audit](05-general-bugs.md), [review](05-general-bugs-review.md)                     |
| BUG-002      | Rotation dialog bypasses selected-specialization legacy-name codec | Bug                         | Medium         | High                                                        | Confirmed                                    | [Audit](05-general-bugs.md), [review](05-general-bugs-review.md)                     |
| BUG-003      | Pending weapon hotkeys can author the previous weapon's skill      | Bug                         | Medium         | High for bound event path; browser timing untested          | Confirmed with corrections                   | [Audit](05-general-bugs.md), [review](05-general-bugs-review.md)                     |
| PROF-R001    | Outgoing pet Alacrity accelerates replacement pet command recharge | Bug                         | Medium         | High for recipient/lifetime violation                       | Reviewer discovery; confirmed by coordinator | [Discovery and independent checks](01-profession-consistency-review.md)              |
| BUG-R001     | Missing synthetic availability disables Dodge + Auto               | Bug                         | Medium         | High                                                        | Reviewer discovery; confirmed by coordinator | [Discovery and independent checks](05-general-bugs-review.md)                        |

## Reconciliation and rejected subclaims

No original ID was removed. The following corrections materially constrain implementation:

- **BUG-003:** the original normal-click Dodge + Auto reproduction is rejected: the actual tile is already blocked by
  `pal-context-disabled`. The independently reproduced path uses bound Backquote then Digit1 hotkeys while the baseline
  is pending. The settled control authors the correct weapon skill. BUG-R001 records the separate blocked synthetic
  action. Calling the existing planning helper without addressing its stale tail fast paths is insufficient.
- **KERNEL-003:** a blanket “only instant/independent casts may overlap” policy would break intentional Vindicator
  authoring and importer behavior. Preserve explicit supported exceptions while preventing unsupported conflicting
  resource commits. The broken macro UI does not remove the authored/native overlap contract.
- **PROF-003:** adopting the existing shared controller alone would inherit PROF-R001. Shared recharge must carry the
  companion identity and lifetime; autonomous and commanded actions may retain legitimate scheduling differences.
- **PROF-004:** this is an optional ownership simplification, not a demonstrated gameplay defect. Preserve profession
  gate precedence and dynamic/free cost behavior. The review corrects which existing tests exercise Initiative costs
  versus Preparation flips; do not treat the latter as cost regression coverage.
- **UI-004:** distinguish Enter in a search input from native activation of a focused option. Both need validation; a
  DOM fixture cannot prove the browser's eventual focus placement or assistive-technology experience.
- **PLATFORM-001:** ordinary saved-build restoration canonicalizes trait objects/IDs; the demonstrated omission applies
  to direct/custom configurations. Normalize numeric strings before lookup, including leading-zero inputs, instead of
  fixing only one string comparison.
- **PLATFORM-003:** existing `scheduleForCast` already expresses the required queued completion-tail behavior.
  Downgraded to informational cleanup; no new lifecycle framework is needed. Preserve ordering, cancellation, and
  committed interruption semantics. Thief Preparations remain armed until triggered, not for an inferred finite expiry.
- **KERNEL-007:** positive-integer validation already exists. The missing protection concerns safe-integer/size bounds
  and admission before eager allocation. Do not claim that fractional packet counts are accepted or that a shipped skill
  caused a measured browser freeze.

Other important scope limits remain: PROF-001 does not demonstrate normal-browser double-counted Vitality or incorrect
DPS; KERNEL-002 is not reached through the coordinator's current empty queue construction; KERNEL-004/005 show timeline
or fact-recording divergence without establishing a direct DPS error. Rejected or unverified CSS/lifecycle/accessibility
candidates remain in the frontend reports rather than being converted into confirmed dead code.

## Coordinator validation of reviewer discoveries

The coordinator inspected each discovery's source and consumer path, reran the review probe, and executed additional
controls against unchanged compiled baseline modules. Essential reproduction code is preserved in the review reports;
ignored diagnostic files are not necessary to understand the findings.

**PROF-R001:** Core Ranger starts with Tiger, swaps after two seconds to Carrion Devourer, then commands Poisonous Cloud
twice after another second. A party grant at zero is addressed only to the outgoing pet. At the five-second probe the
replacement is `ranger-pet:2:1` and its actual Alacrity stack count is zero in every case.

| Control                                       | Projected recharge-ready time (seconds) | Actual command start times (seconds) |
| --------------------------------------------- | --------------------------------------: | ------------------------------------ |
| No Alacrity grant                             |                                   34.32 | 4.32, 34.40                          |
| Thirty-second grant to outgoing pet           |                                   28.32 | 4.32, 30.64                          |
| Same grant to player, summon sharing disabled |                                   34.32 | 4.32, 34.40                          |
| Outgoing pet grant expires before swap        |                                   34.32 | 4.32, 34.40                          |

The projection and actual second start are different observations; ordinary pet scheduling also affects start time. All
controls completed without simulation warnings. The concrete inconsistency is using another incarnation's boon, not a
claim about an externally measured game cooldown.

**BUG-R001:** the real saved Power Vindicator build, an empty settled rotation, and each starting weapon set produce
ready native Dodge Jump and autoattack verdicts. The UI-only `__vindicator_dodge_auto` has no catalog availability entry
and is denied with “No runtime availability verdict for this skill.” Its expansion is `[23275, 29057]` on set 1 and
`[23275, 62913]` on set 2, with the second action explicitly concurrent. Actual generated markup has
`pal-context-disabled`, and the actual bound click adds zero commands. Coordinator checks of both weapon sets were
warning-free. Synthetic action eligibility should derive from its supported constituent actions; it must not broadly
permit missing native verdicts.

## Duplicate mappings and cross-cutting ownership

There are no exact duplicate IDs to discard. The following mappings nominate the finding to own each focused change and
retain distinct neighboring defects rather than counting one repro twice.

| Area                                | Canonical owner                                                                 | Related findings and boundary                                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared settings cache validity      | BUG-001                                                                         | Own all-tab Current/Reference invalidation or input signatures; do not invalidate unrelated tabs for build-local edits.                                           |
| Legacy rotation skill identity      | BUG-002                                                                         | Own selected-specialization name resolution; preserve intentionally explicit numeric IDs.                                                                         |
| Pending authoring freshness         | BUG-003                                                                         | BUG-R001 owns synthetic eligibility; KERNEL-003 owns runtime overlap/resource admission. The rejected macro-click repro belongs to the eligibility problem.       |
| Companion-aware recharge intervals  | PROF-R001                                                                       | Prerequisite for PROF-003's autonomous recharge migration; preserve incarnation and retirement in shared infrastructure.                                          |
| Dynamic autonomous recharge         | PROF-003                                                                        | Distinct from the identity leak. Use shared earned-work semantics after identity is safe, retaining pet-specific scheduling.                                      |
| Executed boon history               | KERNEL-004 for replay ordering; KERNEL-005 for missing facts                    | Same subsystem, separate failures and regression fixtures. Avoid repairing a missing event by changing replay order.                                              |
| Shared activation cost contract     | KERNEL-001 for affordability; KERNEL-003 for conflicting commits                | PROF-004 is a later optional Initiative ownership migration; do not bundle it with correctness fixes.                                                             |
| Bounded profession extension points | PLATFORM-002 for readonly state; PLATFORM-003 for optional ordering convenience | Existing platform contracts already cover much of the requested behavior. Preserve explicit profession extensions rather than building one oversized abstraction. |
| Frontend reduction                  | UI-002 for hidden subtree; UI-003 for redundant declarations                    | Separate small deletions after appearance, responsive, selector, and model-consumer checks.                                                                       |

The profession report recommends a shared contract for registration, immutable definitions, runtime state, availability,
execution, effects, scheduling and presentation while retaining mechanics-specific extensions. Its nine-profession
matrix and migration blueprint should guide incremental ownership changes; identical file layouts are not a correctness
requirement.

## Prioritized implementation sequence

Each row is a focused follow-up change or a small group of independently reviewable changes. This audit PR does not
implement them. Behavior preservation comes before optional consolidation.

| Order | Follow-up                                                                                                          | Dependencies and required validation                                                                                                                                                                                                                                   |
| ----- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Align shared cost admission with spending (KERNEL-001)                                                             | Reproduce fractional boundaries on both sides of readiness, preserve exact-time execution, and verify score/detailed parity. Avoid masking deficits with an unrelated amount epsilon.                                                                                  |
| 2     | Make overlapping resource admission explicit (KERNEL-003)                                                          | Separate from the tolerance fix. Test Firebrand conflicting page costs, serial waiting, interruption/commit semantics, and intentional Vindicator Dodge Jump overlap.                                                                                                  |
| 3     | Repair shared-setting cache validity (BUG-001)                                                                     | Test inactive Current and pinned Reference caches, bulk/single setting controls, changing back to the prior value, and build-local edits. Recompute lazily; avoid unnecessary background simulation.                                                                   |
| 4     | Use the selected-specialization rotation codec (BUG-002)                                                           | Test duplicate legacy names, all loading entry points, malformed inputs and preserved explicit IDs. Include the Virtuoso Bladecall counterexample.                                                                                                                     |
| 5     | Repair pending authoring freshness (BUG-003), then synthetic action eligibility (BUG-R001)                         | Separate changes, coordinated tests. Compare rapid and settled swap/weapon hotkeys, both starting weapon sets, pending workers and native denial. Preserve authored Vindicator overlap without allowing arbitrary unknown skills.                                      |
| 6     | Bind recharge to companion identity/lifetime (PROF-R001), then integrate autonomous earned work (PROF-003)         | Identity fix is a prerequisite. Test outgoing/incoming pets, retirement, grant/expiry mid-recharge, player-only grants, no-boon controls, multiple actions and pet-specific scheduling.                                                                                |
| 7     | Record No Quarter extensions (KERNEL-005), and preserve executed tie order on replay (KERNEL-004)                  | Separate fixtures for missing facts and priority/causal inversions. Compare live/query/result timelines and score/detailed outputs; do not infer a damage fix from display-only evidence.                                                                              |
| 8     | Restore supported UI behavior (UI-001, UI-004)                                                                     | Independent small changes. Run real browser tests for alternate Elementalist gear, reset/visibility, keyboard Enter/Space, focus restoration, both pet slots and conditional removal. Preserve combat-swap policy and accessibility.                                   |
| 9     | Fix narrow ownership/input defects (PROF-001, PLATFORM-001)                                                        | Verify raw/canonical stat provenance and absence of double counting; normalize trait IDs consistently for both occurrence gates, including leading-zero strings.                                                                                                       |
| 10    | Harden extension contracts (KERNEL-002, PLATFORM-002)                                                              | Preserve coordinator construction order; test constructor/enqueue preparation parity and type-level readonly queries without breaking writable lifecycle hooks.                                                                                                        |
| 11    | Resolve horizon policy (KERNEL-006) and bound packet expansion (KERNEL-007)                                        | Separate decisions. Choose/document strict or tolerant horizon behavior with boundary tests. Define safe packet budgets and reject before allocation; use bounded fixtures rather than allocating absurd sizes.                                                        |
| 12    | Correct accessor documentation (PROF-002); then consider small reductions (UI-002, UI-003, PROF-004, PLATFORM-003) | Documentation can land independently at any time. Preserve Revenant selectors/loadout consumers and visual states; remove only proven redundant declarations. Cost/lifecycle consolidation follows correctness coverage and requires demonstrated maintenance benefit. |

## Coverage, limitations, and unresolved decisions

- **Professions:** the initial matrix covers nine professions and all 45 Core/elite runtime variants. Inventory, fresh
  state checks and smoke simulations cover all variants; representative skills and mechanics were traced deeply for each
  profession. The reviewer independently matched the 45 inventory/smoke results. This does not establish every skill,
  trait interaction or balance value as correct.
- **Kernel:** all nine generic kernel modules and their tests were read. The static kernel-import inventory has 222
  files across the application, with consequential consumer paths traced selectively. Queue, timing, RNG, immutability,
  state isolation and parity controls are recorded in the kernel reports. “Exhaustive” does not mean all possible
  defects were ruled out.
- **Platform:** 209 TypeScript files across 15 domains were inventoried; each domain's actual deep/sample coverage and
  gaps are listed in the platform report. Counts are not claims that every line or equipment/mechanic combination was
  independently reviewed.
- **Frontend/integration:** all 24 CSS files are reachable through stylesheet imports. Cleanup conclusions account for
  shipped templates, dynamic/conditional states and the cascade, but no real browser was available. DOM fixtures and
  actual bound handlers validate specific logic paths; they do not substitute for responsive screenshots, assistive
  technology, browser storage, real Workers, embedding, or end-to-end latency measurements.
- **Existing behavior and external facts:** documented constant player boons, full player health and absent incoming
  damage are scope choices. Open issues #66/#70 were not relabeled as discoveries. Known-issue checking was bounded; no
  claim of complete issue/PR history or exhaustive live-game balance verification is made. Findings rely on internal
  contracts, and profession timing claims are qualified accordingly.
- **Remaining policy choices:** KERNEL-006 proves disagreement, not which horizon policy should win. KERNEL-007 needs an
  agreed safe materialization budget. PROF-004/PLATFORM-003 are optional simplifications whose maintenance benefit must
  justify migration. Resolving these requires an explicit contract decision and targeted tests, not a majority vote.
- **Remaining runtime evidence:** UI-004 needs real browser focus/keyboard checks; UI cleanup needs appearance and
  responsive comparison. BUG-003's event path is reproduced without measuring human gesture timing. KERNEL-004's
  native-rotation incidence and direct DPS impact of KERNEL-004/005 remain unestablished. These limits do not erase the
  bounded source-supported conclusions.

No unresolved original finding or missing review is concealed. Unnumbered hypotheses and negative controls remain in the
individual reports. Review corrections supersede conflicting original subclaims; the original files remain unchanged.

## Final verification

All ten reports and this summary are present; each report records the same source baseline. Every original finding has
an explicit independent disposition, and both reviewer discoveries have coordinator validation. Final checks verify
frozen original hashes, source citation paths and line bounds, relative report links, register completeness, Markdown
formatting and a diff limited to this audit directory. The baseline broad check was run once; reviewers ran only focused
diagnostics and neighboring tests documented in their own reports. Passing existing tests does not refute the newly
demonstrated combinations.
