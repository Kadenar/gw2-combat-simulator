# Code-health handoff: remaining work

Remaining work from the 2026-09-23 read-only code-health audit. Every item was re-verified against `b95ff8321`
(2026-09-23). Line numbers refer to that commit.

Cleanup rechecked on 2026-09-24 after the cooldown/Alacrity refactor. The D-item notes below supersede the original
audit. Other bug and consolidation entries retain their original audit status and may need rechecking.

## Status

| ID     | Item                                                   | Severity | Status                                              |
| ------ | ------------------------------------------------------ | -------- | --------------------------------------------------- |
| L2     | "Below 50% health" rules disagreed at exactly 50%      | Low      | **Done** in `bfe197b51` (shared strict helper)      |
| L3     | Pinned target-health config fields bypassed damage     | Low      | **Done** in `bfe197b51` (fields removed)            |
| 1 (S1) | Troubadour instrument cache goes stale in scheduling   | Critical | Open, reproduces                                    |
| 2 (L1) | Sigil of Energy restores no endurance for Elementalist | High     | Fixed with shared resource capability               |
| 3 (S2) | Alacrity sampled at the wrong time for recharge        | High     | Open, reproduces                                    |
| 4 (S3) | Concurrent Combat Start can be backdated               | Medium   | **Done** (clamped to scheduler clock)               |
| 5 (S4) | Internal-cooldown boundary semantics disagree          | Low      | Open, **needs a decision**                          |
| 6 (S5) | Revenant release/starvation cooldowns skip Alacrity    | Low      | **Done** (shared recharge policy)                   |
| 7 (L4) | Profession event types registered as common types      | Low      | Open                                                |
| 8 (L5) | `combo`/`aura` handlers ignore `ctx.reporting`         | Low      | **Done** (reporting writes guarded)                 |
| C1–C7  | Consolidation                                          | Refactor | Open except **C5 done**                             |
| D1–D13 | Dead code and obsolete shims                           | Cleanup  | Done; D11 saved-input migration retained by request |

Leftover from the L2/L3 fix: `ranger/core/mechanics/resolution-helpers.ts:90` still defines its own
`targetHealthFraction`. It now agrees with the platform helper, so it is a duplicate, not a bug. Replace it with
`remainingTargetHealthFraction` when you next touch that file.

## Before you start

- **Shared checkout.** Other sessions edit this tree. Stage files explicitly and never use `git add -A`. At the time of
  writing, Revenant files had uncommitted edits (`revenant/core/execution/hooks.ts`, `revenant/family-state.ts`). Items
  6 and C1 touch Revenant, so coordinate first.
- **AGENTS.md rules that matter here.** No compatibility aliases or fallbacks: update consumers to one canonical shape.
  Run Prettier on every touched file. Tests must be focused engine-contract tests. Preset regressions compare total DPS
  to the manifest within 1%.
- **Repro setup.** The audit ran repros against a private build so the shared `dist/` was untouched:
  `node node_modules/typescript/bin/tsc -p tsconfig.build.json --outDir <tmp>/pkg/dist`, plus a copy of `package.json`
  in `<tmp>/pkg` whose `imports` point at `./dist/js/...`. `tests/games/gw2/app/benchmarks/preset-benchmark.js` shows
  how to run a saved preset through the app adapter.

## Bugs, in priority order

### 1. Troubadour instrument cache goes stale during scheduling (Critical, small magnitude)

- **Where:** `js/games/gw2/professions/mesmer/specializations/troubadour/mechanics/instrument-rules.ts:33-45`.
- **Problem:** `instrumentEvents()` caches the filtered `mesmer.instrument` events in a `WeakMap` keyed by the
  `context.events` array. During scheduling, that array is the scheduler's live event list: it grows in place and its
  identity never changes. The first scheduler-side modifier query (a boon-duration or critical-fact query) caches
  whatever instruments exist at that moment. Every later query reuses that list, so Fortissimo (which scales
  Concentration, and therefore boon duration) and Lute drop out of scheduler-side predictions. The resolver is
  unaffected because it queries a new, final array.
- **Evidence:** The Troubadour preset "Power (Dagger-Sword / Spear)" gives 42785.36 DPS, matching the manifest's 42785.
  With only the cache disabled, it gives 42853.57 (+0.160%). The manifest value was calibrated with the bug.
- **Fix:** Remove the cache, or key it on `(array, length)`. In the scheduler phase, read
  `context.eventsOfType('mesmer.instrument')`, which is already indexed and live.
- **Test:** A focused test that a scheduler-phase modifier query sees an instrument emitted after an earlier query in
  the same run.
- **Done when:** The preset changes by about +0.16%, and `data/gw2/builds/mesmer/manifest.json` has the refreshed
  `benchmarkDps`.

### 2. Sigil of Energy restores no endurance for Elementalist (High)

- **Fixed on 2026-09-24.** The sigil engine now grants through the active `resources.endurance` policy. Professions
  select their existing pool and derive capacity from policy; no mutable `maximumEndurance` field is required.
- **Original problem:** The shared grant silently skipped Elementalist because its maximum was held in a balance
  profile. Mirage separately restored a hardcoded 50 endurance from a proc listener.
- **Repro now passes:** Elementalist Core, Scepter/Dagger, `sigilSets: [{ names: ['Energy'] }, { names: [] }]`, rotation
  `[combat-start, Dodge, Dodge, Air Attunement, Dodge]`. The third dodge starts at the Energy grant without waiting.
- **Coverage:** Focused tests cover all existing endurance owners, unsupported and malformed capabilities, active
  profile capacities, deferred/cancelled grants, and Mirage's single Energy grant. Existing preset DPS checks remain
  within their 1% tolerance.
- **Related cleanup:** C3 and C6 are complete. See [ENDURANCE-REFACTOR.md](ENDURANCE-REFACTOR.md) for the design,
  migration checklist, and validation.

### 3. Alacrity is sampled at cast start and at `effectiveEnd`, not when recharge begins (High)

- **Where:** `js/games/gw2/platform/execution/cast-lifecycle.ts:71` and `:80-88` (durations computed in `reserve()` at
  cast start); `js/games/gw2/platform/execution/gw2-policy/policy.ts:362-380`
  (`at = context.at ?? context.effectiveEnd`); `js/games/gw2/platform/execution/scheduler.ts:243-274`.
- **Problem:** SIMULATION-EVENT-CLOCK §4 says "Alacrity is sampled when recharge begins." The code has two problems:
  - It always samples at `effectiveEnd`, ignoring `rechargeAnchor: 'castStart'` and `modifyRechargeStart`.
  - It computes the value at cast start, before any concurrent cast or task has emitted its Alacrity grant.
    `completeReservation` then commits that stale value.
- **Repro:** Use a `defineProfession` fixture:
  - Scenario A: an instant grants 0.5 s of Alacrity at t=0, then a 1 s `castStart`-anchored skill with a 10 s cooldown
    starts at t=0. Expected ready at 8.0; actual 10.
  - Scenario B: a 2 s cast (10 s cooldown) starts at t=0, and a concurrent instant at +500 ms grants 5 s of Alacrity.
    Expected ready at 10.0; actual 12.
- **Fix:** In `completeReservation`, recompute the recharge and ammo-lockout durations with `at = rechargeStart`, using
  the scheduled events known at that point, and update the reservation's `rechargeReadyAt`. `reserve()` still needs a
  provisional `rechargeReadyAt` for in-flight availability checks.
- **Test:** A focused cooldown test covering both scenarios.
- **Done when:** Both scenarios give the expected ready times. Presets should not move, because all 122 saved builds
  assume permanent Alacrity.

### 4. A concurrent Combat Start can be backdated behind the scheduler clock (Medium)

- **Status:** Fixed on 2026-09-24. Offset markers now clamp to `state.time`, including negative offsets; offsets ahead
  of the clock remain unchanged. The original repro now starts combat at 2.0 s, with the first resolved hit and Sigil of
  Ice proc both at 3.0 s. A focused regression in `tests/games/gw2/platform/observation-windows.test.js` covers past,
  negative, and future offsets. The original finding below is retained for context.
- **Where:** `js/games/gw2/platform/execution/scheduler.ts:795-807`. Related: `execution/rotation.ts:54-60` allows
  negative offsets, and `app/rotation/editing/activation-editor.ts` accepts signed combat-start offsets.
- **Problem:** `combatStartTime = previousCastStart + offset` is never clamped to `state.time`. Casts get that clamp at
  line 561; Combat Start does not. Waits and independent casts don't update `previousCastStart`, so a marker placed
  after them lands in the past. Materializer tasks for hits between the marker and the clock already ran while
  `combatStartTime` was null, so they were treated as precombat. The resolver counts the same hits as in-combat.
- **Repro:** A 1 s strike skill plus Sigil of Ice, rotation
  `[Strike, { type: 'wait', durationMs: 1000 }, { type: 'combat-start', concurrentOffsetMs: 500 }, Strike]`.
  `combat_start` lands at 0.5 and the resolver's first hit is at 1.0, but the Ice proc first happens at 3.0. Without the
  wait, it procs at 1.0. The steps list `Combat Start@500` after `Wait@1000`.
- **Fix:** Clamp to `Math.max(state.time, …)` the same way concurrent instants are clamped, or warn and reject a marker
  that would land in the past. Decide whether a negative offset is still meaningful after the clamp.
- **Test:** A focused scheduling test: a backdated marker never precedes the clock, and scheduler procs agree with
  resolver combat-start gating.

### 5. Internal-cooldown boundary semantics disagree (Low, needs a decision)

- **Where:** Sigils: `js/games/gw2/platform/equipment/sigils/proc-events.ts:16` (ready exactly at `readyAt`). Kernel:
  `js/kernel/core/clock.ts:48-54` (blocked at `readyAt`, which is what the clock doc specifies). Ad hoc variants:
  `ranger/specializations/galeshot/mechanics/cyclone-bow.ts:240` and
  `ranger/specializations/soulbeast/mechanics/beastmode-effects.ts:256,275` (ready 0.1 ms early),
  `revenant/core/mechanics/upkeep.ts:227` (ready at `readyAt`).
- **Problem:** Hits at t=0 and t=2.000 against a 2 s cooldown proc twice for sigils, One Wolf Pack, Vulture Stance,
  Wuthering Wind and Impossible Odds, but only once for relics, charges and `advanceCriticalProc`.
- **Decision needed:** Either every internal cooldown blocks at its boundary, per SIMULATION-EVENT-CLOCK §4, or the
  exact-boundary retrigger is deliberate for these mechanics (the comment on `isSigilInternalCooldownReady` suggests
  so), and the doc gets an exception.
- **Fix after the decision:** C2. Add `isInternalCooldownReady(at, readyAt, { inclusive })` to the kernel and migrate
  all six call sites. Expect small preset shifts. Check them against the 1% tolerance and refresh any manifest that
  moves.

### 6. Revenant release/starvation cooldowns skip the recharge policy (Low, fixed)

- **Status:** Fixed on 2026-09-24 after user confirmation that both cooldowns scale with Alacrity.
- **Fix:** `revenant/core/mechanics/upkeep.ts` and `revenant/core/mechanics/energy.ts` now call
  `context.rechargeDurationFor` with the parent skill's manual-release or starvation base cooldown, evaluated at release
  completion or starvation respectively. This preserves their distinct base durations while applying the shared recharge
  policy.
- **Tests:** Focused contracts cover release cooldowns for Impossible Odds, Protective Solace, and Soulcleave's Summit,
  plus Impossible Odds starvation, with and without Alacrity. Revenant preset regressions pass within 1%.

### 7. Profession-owned event types registered as common types (Low)

- **Where:** `js/games/gw2/platform/engine/events/events.ts:41-43`: `cooldown_snapshot` (Mesmer only), `self_condition`
  (Necromancer only), `peitha` (relic and Revenant).
- **Problem:** A common type with no handler is silently ignored (`resolver/event-loop.ts:146-150`). A namespaced type
  with no handler throws. These three types opt out of that safety check.
- **Fix:** Rename them to namespaced types (for example `mesmer.cooldown-snapshot` and `necromancer.self-condition`;
  `peitha` needs a relic-level home) and update every producer, handler and reaction. Do not keep the old names as
  aliases.

### 8. Resolver handlers ignore `ctx.reporting` (Low)

- **Status:** Fixed on 2026-09-24. All three reporting writes now check `context.reporting`; combat reactions and
  Elementalist aura state updates remain unconditional. A focused regression in
  `tests/games/gw2/platform/score-only.test.js` checks report retention, reaction dispatch, and aura state in both
  modes.
- **Where:** `js/games/gw2/platform/resolver/combo-resolution.ts:113,118`;
  `js/games/gw2/professions/elementalist/core/mechanics/reactions.ts:100`.
- **Fix:** Guard these `ctx.resolved.push` calls with `if (ctx.reporting)`, like every other handler. This affects
  score-mode memory only, never numbers.

## Consolidation

Each copy below lives in the directory its path names. Every proposed home respects ARCHITECTURE.md: the platform
imports no profession code, and professions pass their data in.

- **C1. Family-state boundary (about 450 lines).**
  - Copies: nine `professions/*/family-state.ts` files.
  - Each repeats the same projection, snapshot and emit steps. Each `handle*State` also hand-lists the resolver-owned
    keys that must survive a scheduler snapshot. A missing key silently rolls resolver state back, which is exactly the
    recent Necromancer bug.
  - Proposal: `createFamilyStateBoundary({ professionId, projections, resolverOwnedKeys })` in
    `platform/engine/profession/state.ts`, returning `{ emitSnapshot, projectPlanningState, handleState }`.
  - Wait for the in-flight Revenant edits to land first.
- **C2. Internal-cooldown predicates.** See item 5.
- **C3. Endurance ready-at wrappers (6 copies).**
  - **Done on 2026-09-24.** Shared operations in `platform/combat/resources/endurance-policy.ts` now own initialization,
    advancement, readiness, grants, and spending. Profession policies retain pool ownership, capacity, and rate rules.
  - Removed duplicated readiness wrappers and mutable maximum fields; migrated Mirage's separate Vigor scheduling.
  - Capacity is derived for simulation and presentation from the same selected policy and catalog.
- **C4. Resolver-derived buff, condition and proc attribution helpers.**
  - Copies: `elementalist/core/mechanics/resolution-helpers.ts:10-107`,
    `engineer/core/mechanics/resolution-helpers.ts:62-205`, `guardian/core/traits/shared.ts:76-120`,
    `ranger/core/mechanics/resolution-helpers.ts`, `ranger/specializations/soulbeast/mechanics/beastmode-effects.ts`,
    `necromancer/core/mechanics/trait-effects.ts`.
  - They handle priority three ways (Elementalist propagates it, Guardian defaults to −5, Engineer drops it) and fill
    `source` inconsistently.
  - Proposal: `queueDerivedBoon` and `applyDerivedCondition` in `platform/resolver/packets.ts`, with explicit
    attribution and priority.
- **C5. Catalog-aware presentation built on module-level variables (14 bindings, 10 files).**
  - **Done on 2026-09-24.** Presentation factories now capture their own catalogs; shared helpers receive the catalog
    explicitly, including callers in Engineer, Ranger, Guardian, and Necromancer specializations.
  - Previously, each `bind*Ui(catalog)` overwrote module-level state, so assembling a second catalog changed the first
    UI's lookups. All 14 catalog-dependent module-level bindings have been removed.
  - Family presentation now supports the same catalog factory contract as module presentation. Elementalist family
    controls bind directly instead of depending on Core initialization.
  - Focused regressions in `tests/games/gw2/platform/presentation-catalog-isolation.test.js` cover catalog isolation in
    both initialization orders, shared-helper consumers, derived collections, and family/Core composition.
- **C6. Sigil of Energy grant.** Done with item 2; removed the Mirage-specific duplicate grant.
- **C7. Base-recharge lookups.**
  - Copies: `guardian/core/mechanics/weapon-state.ts:47` (default 5),
    `guardian/specializations/luminary/mechanics/radiant-forge.ts:366` (10), `mesmer/core/mechanics/recharge.ts:46` (0),
    `necromancer/core/traits/index.ts:81` (5), `revenant/core/traits/index.ts:36` and
    `revenant/specializations/conduit/traits/index.ts:67` (the effect duration).
  - They use `cooldown ?? recharge ?? <default>`, and none honors `ammoRecharge`.
  - Fix: use `gw2BaseRecharge` from `platform/skills/recharge.ts`. Pair this with D10.

## Dead code and obsolete shims

### Cleanup outcome (2026-09-24)

- **D1–D8:** Removed the unused Engineer re-export block, the two unused Luminary re-exports, the unused Dragon Flow
  constant, the queue's `EPSILON` re-export, the default preview export (including its authoring generator), the
  unreachable effect-duration branch, and the redundant Poison/Immobilize aliases. Luminary's consumed barrel exports
  remain.
- **D9:** Already removed by the earlier target-health cleanup.
- **D10:** Removed `Skill.recharge` and its runtime fallbacks. Generated snapshots, supplemental data, authored skills,
  and the metadata generators now use `cooldown`, `ammoRecharge`, and `ammoCastLockout`. Evolve (Double Helix) retains
  its one-second lockout; Panther's Prowl explicitly retains its half-second lockout despite the API's missing ammo
  count. All nine assembled catalogs retain their previous base recharge, cooldown, and ammo-lockout values. The helper
  now lives in `platform/engine/skills/recharge.ts` following the refactor.
- **D11:** Log reconstruction now emits the shared `RotationCommand` types directly; its duplicate legacy command types
  are removed. Repository rotation assets use canonical object commands. The palette already did so. **At the user's
  explicit request, legacy normalization remains at the shared input boundary** for downloaded rotations and local
  storage. Regression coverage checks JSON imports, the single-build storage slot, workspace tabs, template reset
  builds, My Builds, and canonical workspace re-saving across all nine professions. Do not remove this migration path.
- **D12:** Removed the unused infinite resolver-horizon branch; observation policies provide finite horizons.
- **D13:** Made 206 value declarations module-private after checking imports, re-exports, namespace imports, and dynamic
  entry points across source, scripts, and tests. Exported types and the documented public simulation entry point
  remain.

Validation: module/site builds, type checking, ESLint, all preset regressions, and 11 focused Chrome checks passed. The
full Node suite finished with **3,691 passing tests and 7 failures**, all reproduced on unchanged HEAD before this
cleanup:

- `tests/games/gw2/platform/runtime-query.test.js`: four fixtures omit the catalog now required by combat queries.
- `tests/games/gw2/platform/slaying-equipment.test.js`: one fixture omits that same catalog.
- `tests/games/gw2/platform/transition-delays.test.js`: two existing exit-recovery assertions fail (Specter exit and
  `0.72` versus `0.7` seconds).

The two stale assertions in the touched `skill-recharge.test.js` were updated to the refactor's action-tick detection
and planning-state projection. No preset warnings were suppressed and no benchmark values changed.

The original findings below are retained as audit context; their “Safe to delete?” column describes the pre-cleanup
state, not remaining work.

All items were checked with an import graph over `js/`, `tests/` and `scripts/` (path aliases, dynamic imports and
`new URL(...)` workers resolved), then confirmed with `rg`. Paths are relative to `js/`.

| ID  | Location                                                                                                  | What                                                               | Safe to delete?                                                                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | `games/gw2/professions/engineer/core/mechanics/reactions.ts:21-29`                                        | Re-export block with no importer                                   | Yes                                                                                                                                                                                                        |
| D2  | `games/gw2/professions/guardian/specializations/luminary/skills/index.ts:19,22`                           | Barrel re-exports; consumers import the leaf files                 | Yes                                                                                                                                                                                                        |
| D3  | `games/gw2/professions/warrior/specializations/bladesworn/mechanics/dragon-trigger.ts:15`                 | `DRAGON_FLOW_PER_INTERVAL`, never referenced                       | Yes                                                                                                                                                                                                        |
| D4  | `kernel/events/queue.ts:6`                                                                                | `export { EPSILON }`; importers use `clock.js`                     | Yes                                                                                                                                                                                                        |
| D5  | `games/gw2/integrations/patches/active-preview.ts:9`                                                      | Default export; all importers use the named export                 | Yes                                                                                                                                                                                                        |
| D6  | `games/gw2/platform/execution/gw2-policy/policy.ts:327`                                                   | `effect.fixedDuration === true` can never be true                  | Yes                                                                                                                                                                                                        |
| D7  | `games/gw2/platform/combat/formulas.ts:50`                                                                | `Poison` alias; names are canonicalized to `Poisoned` first        | Yes                                                                                                                                                                                                        |
| D8  | `games/gw2/professions/elementalist/core/mechanics/reactions.ts:269`                                      | `'Immobilize'` alias; condition names are already canonical here   | Yes                                                                                                                                                                                                        |
| D10 | `games/gw2/platform/execution/scheduler.ts:265,269`, `games/gw2/platform/skills/recharge.ts:16`, C7 sites | `skill.recharge` fallback                                          | Not yet. Amalgam's Evolve (Double Helix) uses `recharge: 1` as its ammo cast lockout, and generated metadata keeps `recharge`. Normalize it to `cooldown`/`ammoCastLockout` at the catalog boundary first. |
| D11 | `games/gw2/platform/execution/rotation.ts:34-131`                                                         | Legacy rotation fields (`offset`, `interruptMs`, `waitMs`, `name`) | Not yet. Log reconstruction and the palette still produce them. Make those emit canonical commands first.                                                                                                  |
| D12 | `games/gw2/platform/resolver/event-loop.ts:97`                                                            | `horizon === Infinity` branch; nothing passes an infinite horizon  | Yes. If you keep it, guard `condition-resolution.ts:101`, which would never terminate with an infinite horizon.                                                                                            |
| D13 | 562 sites                                                                                                 | `export` keywords on symbols used only inside their own module     | Mostly. Some exported types are intentional public surface.                                                                                                                                                |

`platform/index.ts` is imported only by tests, but it is the documented public entry point in
`docs/architecture/PROGRAMMATIC-SIMULATION.md`. Keep it.

## Open questions for the owner

1. Item 5: should internal cooldowns be ready exactly at their boundary, or blocked at it?
2. Item 6: do Revenant upkeep release and starvation cooldowns scale with Alacrity?
3. Ammo charges: the per-charge recharge duration is fixed when the first charge is spent (`cooldowns.ts:101-103`), so
   an Alacrity change mid-chain doesn't affect the remaining charges. Is that approximation acceptable?
4. Performance, not correctness: when any `boon_extension` exists, the scheduler's boon queries replay the whole event
   log on every call (`gw2-policy/policy.ts:129,338`).
