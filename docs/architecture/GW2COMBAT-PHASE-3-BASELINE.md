# Phase 3.1: migration inventory and legacy baseline

Recorded 2026-09-16 against `038300b2f51ef9c5644d5cc300bd1aa0fd03f0c8`, with the migration plan and baseline tooling
uncommitted. This is implementation evidence for
[Phase 3.1](GW2COMBAT-TYPESCRIPT-MIGRATION.md#31--close-prerequisites-and-record-the-consumer-map), not a new-engine
compatibility claim. Application build models, rotation commands, persisted formats, and runtime code are unchanged.

## Execution callers and disposition

Paths below are relative to `js/games/gw2/` unless prefixed with `scripts/`. Source searches covered `js/` and
`scripts/` for `simulateGw2`, `simulateDeclarativeGw2`, `simulateBuild`, `calculateBaselineSimulation`, `runSimulation`,
and `rotationEndStateAt`. The legacy pipeline has no external production callers bypassing `simulateGw2` in this
checkout.

| Caller / owner                                                                               | Current path                                                                                 | Phase 3 disposition                                                                                                     |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `platform/simulation/simulate.ts`                                                            | Detailed/score dispatch into `pipeline.ts`                                                   | Own whole-run selection and capability validation                                                                       |
| `app/create-runtime.ts`                                                                      | Adapter `simulateBuild`, synchronous `runSimulation`, baseline and analysis request builders | Carry selected engine and immutable input; preserve legacy default                                                      |
| `app/profession-app.ts`                                                                      | Initial synchronous baseline; edit scheduling; result publication; build-tab switching       | Route first paint too; suppress unavailable automatic analyses; invalidate stale results                                |
| `app/simulation/baseline-simulation.ts`                                                      | Direct simulations for baseline, reference rotation, current patch, preview patch            | Baseline supported; reference/patch comparisons unavailable in preview                                                  |
| `app/simulation/baseline-simulation-worker.ts`                                               | Loads headless profession and calculates serialized baseline                                 | Carry engine/input identity and structured errors                                                                       |
| `app/simulation/baseline-simulation-runner.ts`                                               | 40 ms debounce, one in-flight job, coalesced pending edits, main-thread fallback             | Preserve request/revision/worker checks; replace expensive obsolete workers; preview must not take synchronous fallback |
| `app/create-runtime.ts`, `app/rotation/shared/context.ts`                                    | Synchronous prefix replay and result/index cache                                             | Worker-backed new-engine projection; full cache identity; explicit pending state                                        |
| `app/simulation/random-distribution/random-distribution.ts`, `random-distribution-worker.ts` | Callback and direct worker calls                                                             | Preview unavailable, including automatic scheduling from baseline publication                                           |
| `app/simulation/modifiers/modifier-contributions.ts`, `modifier-contribution-worker.ts`      | Baseline/removal comparisons via callback or direct worker                                   | Preview unavailable, including view-change scheduling                                                                   |
| `app/simulation/relic-comparison/relic-comparison-runner.ts`                                 | RNG-worker comparisons and synchronous adapter fallback                                      | Preview unavailable on both paths                                                                                       |
| `app/simulation/gear-optimizer/gear-optimizer.ts`, `gear-optimizer-worker.ts`                | Adapter detailed evaluation; direct `simulateGw2` score evaluation; worker driver            | Preview unavailable for preparation, candidate evaluation, and finalist verification                                    |
| `scripts/analysis/capture-supported-build-metrics.mjs`                                       | Adapter simulation; consumed by `compare-supported-build-dps.mjs`                            | Legacy default; explicit future selection must propagate                                                                |
| `scripts/analysis/benchmark-gear-optimizer*.mjs`                                             | Direct simulation, evaluator/space, or browser optimizer                                     | Legacy workload tools; no implicit preview fallback                                                                     |
| `scripts/analysis/benchmark-migration-baseline.mjs`                                          | Common boundary, prefix adapter, production browser worker/editor                            | Reproducible baseline added in 3.1; later extend explicitly for selected engine                                         |
| `scripts/analysis/profile-combat-engine.mjs`, `gw2combat-reference/*`                        | Deliberate direct reference-engine runs                                                      | Keep separate reference lane; not production routing                                                                    |

The generic worker harness lives at `js/app/simulation/game-worker-harness.ts`; keep it game-neutral. The current
baseline runner rejects obsolete request IDs, build revisions, and messages from abandoned workers, but has no engine
identity. Publishing a baseline schedules RNG, modifier, and relic runners. Both publication and their request handlers
need capability gates; disabling buttons alone misses these calls.

## Result consumers and field ownership

`platform/simulation/types.d.ts` adds scheduler output to `platform/resolver/types.d.ts`. The adapter must supply actual
engine observations for each supported field, never fake scheduler state or run the legacy scheduler to populate views.
The existing result uses mixed units: summaries/resolver events use seconds; scheduler steps, proc steps, and public
`endState.time` use milliseconds; `schedulerState.time` is seconds.

| Fields / behavior                                                                                                                | Owning consumers                                                                                                                      | Disposition                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `duration`, `combatStartTime`, `hasExplicitCombatStart`, `dpsStartTime`, `dpsWindow`, `firstHitTime`, `lastHitTime`, `deathTime` | `app/results/model.ts`, `result-transform.ts`, `charts/time-series-model.ts`, `rotation/timeline/*`                                   | Adapt distinct execution, damage, and observation clocks; preserve marker/death boundaries                                          |
| `totalDamage`, `dps`, `strikeDamage`, `conditionDamage`, `environmentDamage`, `environmentDps`                                   | `app/results/result-transform.ts`, `view.ts`                                                                                          | Account player/owned-actor damage separately from environmental target damage                                                       |
| `breakdown`, `conditionBreakdown`, `environmentConditionBreakdown` including damage ticks                                        | `app/results/result-tables.ts`, `result-transform.ts`, `view.ts`                                                                      | Preserve skill/source identities, condition grouping, DPS windows, and target-health milestones                                     |
| `events`, `resolvedEvents`, event order, hit attribution, conditions, buffs                                                      | `app/results/simulation-event-log.ts`, `charts/time-series-model.ts`, `result-tables.ts`, `platform/results/query.ts`                 | Project emitted observations once; retain equal-time order and lifetime information                                                 |
| `steps`: source index, skill ID, activation ID, start/end, interrupted/invalid state                                             | `app/rotation/timeline/model.ts`, `rows.ts`, `app/results/warnings.ts`                                                                | Capture identity at command acceptance; render actual execution                                                                     |
| `procSteps`: source/parent, start/end, stacks, expiry                                                                            | Timeline models, result tables/view, `app/rotation/state-snapshot/model.ts`                                                           | Observe triggered actions and timed effects; do not invent casts from display names                                                 |
| `rotationApm`                                                                                                                    | `app/results/model.ts`                                                                                                                | Reuse presentation; derive from real accepted activation/rotation timing                                                            |
| `warnings` and invalid-step diagnostics                                                                                          | `app/results/warnings.ts`, `profession-app.ts` failure path                                                                           | Preserve responsible command/field; no partial-success result on failure                                                            |
| `endState.time`, cooldowns, `ammo`, `ammoBySkillId`, active weapon set                                                           | `app/rotation/shared/context.ts`, `palette/model.ts`, `state-snapshot/model.ts`                                                       | Engine prefix query; ID-keyed availability; append before observation tail                                                          |
| `endState.profession`                                                                                                            | Palette/state snapshot; `app/build/panels/skills.ts`, `state/skill-selection.ts`, `app/create-runtime.ts`, `app/simulation/config.ts` | Explicit profession projection; avoid stale state affecting skill selection/config                                                  |
| Critical chance/contributors, timed buffs, relic expiry                                                                          | `platform/results/query.ts`, `app/rotation/state-snapshot/model.ts`                                                                   | Observer-derived facts; unavailable diagnostics must be labeled rather than fabricated                                              |
| `schedulerState.time`                                                                                                            | `app/rotation/timeline/rows.ts`                                                                                                       | Replace consumed internal clock with explicit rotation/observation boundary                                                         |
| Other `schedulerState`, `snapshot`, raw `profession`, `casts`, `randomness`                                                      | Public/headless result contract; no direct app reads found for the raw fields beyond the clock above                                  | Keep legacy internals branch-specific; retain new-engine seed/mode identity; inspect headless compatibility when adapting contracts |
| Contributions, RNG distributions, relic results, patch/reference deltas                                                          | Analysis runners, result view, rotation comparison                                                                                    | Unavailable for preview; clear carried legacy analysis on engine change                                                             |

`app/rotation/palette/model.ts` currently applies `profession.ui.paletteSkillAvailability`; the preview must use engine
legality instead. Prefix-state cache hits currently depend on result identity and insertion index only. Failed baseline
jobs can leave prior results visible; preview status must distinguish stale results from valid results for the new
input.

## Saved inputs and translation requirements

All nine professions use `platform/builds/codec.ts` through their profession-owned codec. Current schema versions are 4
for Elementalist/Ranger and 3 for the other seven. Workspace/tab and My Builds envelopes in
`app/build/state/workspace.ts` are version 1. Keep these versions, storage keys, and migration rules.

`app/build/io/files.ts` accepts a bare rotation array or `{ rotation }`, exports builds with or without rotation, and
loads manifest bundles. `build-file-import.ts` normalizes through `app/build/state/persistence.ts`. Build chat codes use
`platform/builds/templates/codec.ts`; EVTC, Elite Insights/dps.report, and Wingman inputs converge through the existing
rotation-import modules. They produce the existing commands; none should start persisting upstream JSON/CSV.

`RotationCommand` in `platform/engine/execution/types.d.ts` comprises casts, waits, combat-start, and cooldown-reset.
Cast options include off-target, concurrent offset, interruption, initial-state duration, charge release, and
double-edge outcome. Inventory their representability individually. Unknown/unsupported input must remain intact in
application state even when preview execution rejects it.

The common request currently contains profession, normalized rotation, and **derived `Gw2Config`, not the saved build**.
That config includes weapon-set stats, static-attribute provenance, trait/skill selection, weapons/sigils, food/utility,
relics, boons, target, patch, randomness, and assumptions, but not the complete original gear/rune selection. In 3.2,
capture a clone-safe snapshot of the existing build (or its compiled content) before worker dispatch. Do not reconstruct
the user's build from derived stats, and do not create a second editable model. Respect
`attributeProvenance.professionStaticRulesApplied` to avoid applying passive bonuses twice.

### First-build dependency closure

Use the application's existing `b-condi-willbender-pistol-torch.json` and `r-condi-willbender-pistol-torch-bench.json`
as the translation acceptance input. Keep the upstream fixture separate: their rotations/content are not identical and
their DPS values are not interchangeable.

- Equipment: Viper/Sinister distribution, Balthazar rune, Bursting/Air and Bursting/Torment weapon sigils, Fractal
  relic, Cilantro and Cured Meat Flatbread, Toxic Tuning Crystal, jade bot core, condition-damage infusions, starting
  weapon set 2.
- Build: Radiance 2-2-1, Virtues 3-1-1, Willbender 1-1-2; Litany of Wrath, Purging Flames, Whirling Light, Signet of
  Wrath, Heaven's Palm; pistol/torch and pistol/pistol. Loadout support includes selected support skills even if absent
  from the benchmark rotation.
- Commands: casts, waits, a combat-start marker, off-target preparation, concurrent offsets, and interrupted casts.
  Stored millisecond values in this particular rotation are integral. These existing options are **required** for this
  acceptance build; stripping them or categorically rejecting them cannot complete Phase 3.
- Reference skills/effects: pistol chains and ignition field/projectile procs; Jurisdiction levels; torch flame/fire
  flips and Cleansing Flame; virtue hit counters/windows and flames; Lethal Tempo; Searing Pact; conditional signet
  effects; weapon swap; lifesteal/Air/Torment/Fractal procs; whirl fire-field Burning Bolts; delayed owned actors.
- Reference passive holders: Right-Hand Strength, Radiant Fire/Power, Amplified Wrath, Inspired/Inspiring Virtue, Power
  of the Virtuous, Restorative Virtue, equipment/food holders, and active-state trackers. These have to be selected from
  actual build inputs, not applied unconditionally just because they appear in the fixture.
- Target: four-million health, armor 2597, stationary/idle target, permanent target-condition assumptions, player boons,
  condition tick offset, observation/termination settings, and target-owned Fractal helper behavior. Audit ownership so
  environmental conditions cannot inflate player damage.

The upstream fixture names **Toxic Focusing Crystal**, while this saved application build selects **Toxic Tuning
Crystal**. This is a content mapping discrepancy to resolve in 3.2/4 with explicit semantics, not a spelling alias to
assume. Reference enums, base attributes, effects, historical coefficients, and RNG predicates likewise do not prove
compatibility with current selected content. The preview must reject unmapped content honestly until supported.

Shared platform owners are `platform/builds/attributes.ts`, `platform/combat/`, `platform/resolver/`,
`platform/equipment/`, `platform/combos/`, and `platform/skills/`. Profession content belongs in the owners below; their
legacy execution callbacks are behavior to port, not callable implementations inside the new engine.

## Source-backed profession inventory

Each linked `modules.ts` enumerates Core plus all four elites and imports the actual `module.ts` composition roots.
Those roots enumerate owned skills/profiles, modifiers, execution hooks, resolution reactions, and state factories.
Follow `state.ts`, `mechanics/`, `execution/`, and `traits/` in each listed slice for the concrete implementations. This
is the initial ownership/mechanic inventory, not a completed current-game validation or per-trait migration audit. All
application content remains on legacy; only frozen reference fixtures have new-engine fidelity evidence.

| Profession / source                                                    | Schemas; rotation-backed presets | Core and elite mechanics owned by the registered source modules                                                                                                                                                                                                               |
| ---------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Guardian](../../js/games/gw2/professions/guardian/modules.ts)         | 3; 13                            | Core virtues/Justice, signets, weapon chains/flips, symbols, spear illumination; Dragonhunter virtue tether/traps; Willbender hit counters, flame replacement and Lethal Tempo; Firebrand pages, tomes, mantras, Ashes; Luminary forge/weapon variants, stances, light fields |
| [Thief](../../js/games/gw2/professions/thief/modules.ts)               | 3; 8                             | Core initiative/endurance, steal, stealth and weapon state, Thieves Guild/tasks; Daredevil dodge traits; Deadeye malice/mark; Specter shadow shroud; Antiquary artifacts                                                                                                      |
| [Ranger](../../js/games/gw2/professions/ranger/modules.ts)             | 4; 7                             | Core pets/commands, resources, traps and weapon state; Druid celestial avatar/Blood Moon; Soulbeast beastmode/merge; Untamed unleash/ambush; Galeshot cyclone bow/state transitions                                                                                           |
| [Elementalist](../../js/games/gw2/professions/elementalist/modules.ts) | 4; 41                            | Core attunement/recharge, auras, weapon state, conjures and elementals; Tempest overloads; Weaver dual attunements/Primordial Stance; Catalyst sphere/empowerment; Evoker familiar/resources/recharge                                                                         |
| [Mesmer](../../js/games/gw2/professions/mesmer/modules.ts)             | 3; 8                             | Core clone/phantasm lifecycle and shatters, Mimic/signets/recharge, rifle/Chaos Storm; Chronomancer Continuum Split; Mirage ambush/runtime; Virtuoso blades/bladesongs; Troubadour instruments                                                                                |
| [Revenant](../../js/games/gw2/professions/revenant/modules.ts)         | 3; 11                            | Core energy/upkeep, legend/weapon state, skill flips, spear/Crushing Abyss and scepter; Herald facets; Renegade Kalla summons/reactions; Vindicator alliance/dodge; Conduit affinity                                                                                          |
| [Necromancer](../../js/games/gw2/professions/necromancer/modules.ts)   | 3; 9                             | Core life force, minions, conditions and weapon chains; Reaper shroud; Scourge shades; Harbinger blight/shroud; Ritualist spirits/shards/weapon spells; `definition.ts` additionally owns scheduler-refinement feedback                                                       |
| [Engineer](../../js/games/gw2/professions/engineer/modules.ts)         | 3; 14                            | Core kits/toolbelt/resources, mine field, healing turret, spear; Scrapper trait reactions; Holosmith forge/heat; Mechanist mech; Amalgam evolved form                                                                                                                         |
| [Warrior](../../js/games/gw2/professions/warrior/modules.ts)           | 3; 9                             | Core adrenaline/endurance, burst skills and trait reactions; Berserker berserk; Spellbreaker Full Counter; Bladesworn gunsaber/Dragon Trigger; Paragon chants/commands/motivation                                                                                             |

Guardian state projection is composed by `professions/guardian/state.ts` from slice-owned public/resolver key lists.
Core owns virtue readiness and weapon/symbol state; Dragonhunter owns tether/heavy-light expiry; Willbender owns virtue
expiry/hit counts, flame generation and Lethal Tempo; Firebrand owns active tome/pages/recharge and mantra state;
Luminary owns forge expiry, radiant weapons/one-shot virtue flags and stance stacks. Preserve expiry/cleanup, trigger
ownership, cooldown commitment, and public projection in each port. Existing focused checks live in
`tests/professions/<profession>/`; manifest checks live in `tests/app/benchmarks/`. The 120 manifests/rotations are
smoke and aggregate-DPS evidence, not proof that every selectable mechanic has been migrated.

## Measured legacy baseline

Raw samples, input hashes and environment are in [the baseline capture](GW2COMBAT-PHASE-3-BASELINE.json). Windows
`10.0.26200`, Intel i7-13700K, 24 logical CPUs, 34,162,880,512 bytes RAM; Node 24.14.1; headless Chrome 153.0.8010.47.
Measurements ran sequentially without concurrent tests. Three Node warmups then seven samples; nearest-rank p95 of seven
is the maximum and is only a local baseline. Adapter loads occur sequentially in one process, so only the first has
completely cold shared imports. Single cold simulation excludes adapter loading.

| Workload                                            | Cold run ms | Detailed median / p95 ms | Score median ms | Prefix start / middle / append median ms | 20 score runs + two GCs ms |
| --------------------------------------------------- | ----------- | ------------------------ | --------------- | ---------------------------------------- | -------------------------- |
| Guardian Condition Pistol/Torch + Pistol/Pistol     | 170.16      | 87.43 / 91.73            | 80.53           | 0.37 / 36.15 / 82.74                     | 1781.18                    |
| Thief Power Quickness Sword/Pistol                  | 154.08      | 96.44 / 100.45           | 86.04           | 0.33 / 41.15 / 88.64                     | 1822.20                    |
| Ranger Condition Alacrity Dagger/Torch + Axe/Dagger | 160.97      | 104.19 / 107.64          | 96.26           | 0.27 / 50.05 / 100.40                    | 2082.78                    |

Prefix measurements call the current adapter without a cached result, so append measures replay rather than its
result-reuse fast path. These are Node prefix costs, not browser cursor-paint latency. The saved Guardian rotation and
frozen C++ reference are different workloads: do not compare these times to the Phase 2 reference timings as a speedup.

- Production Guardian page startup to idle: 289.80 ms, one fresh page/context with local server.
- Fresh worker creation plus profession-load acknowledgement: 36.00 ms median, 51.90 ms maximum of three; HTTP cache is
  warm after page load. Worker warm round trip including structured cloning: 78.10 ms median / 108.40 ms p95.
- Actual append/remove-wait edit through `changed(false)`, debounce, baseline worker, publication and two animation
  frames: 179.00 ms median / 183.50 ms p95. Automatic RNG/modifier/relic jobs are explicitly disabled in the benchmark
  page only to isolate baseline work; they remain enabled in the product.
- Post-GC retained Node heap before/after 10/20 score runs: Guardian 65,512,080 / 65,543,536 / 65,426,304 bytes; Thief
  70,941,152 / 71,071,560 / 71,195,976; Ranger 76,393,144 / 76,458,368 / 76,394,416. This short series is not a leak
  test. Peak Node RSS: 372,641,792 bytes. Browser page heap sample: 44,706,040 bytes; this excludes worker heap and is
  not a retained-worker measurement. Long-lived worker-memory acceptance remains Phase 6.
- All production JS assets: 18,739,758 bytes raw / 4,708,556 summed per-file gzip bytes. Baseline worker entry: 224,478
  bytes, excluding imported chunks. Whole-site assets include all professions and multiple workers; these are not
  Guardian network-transfer totals. The existing Vite warning for a minified chunk above 500 kB remains visible.
- Existing Guardian optimizer workload (Power Spear/Greatsword): score median 63.24 ms, six grouped evaluations from
  eight raw candidates, 762.55 ms total including detailed finalist verification. Different build from the first UI
  slice; the combined capture records its full output. This measures an actual optimizer batch in addition to the
  repeated-score throughput above.
- No simulation warnings from any measured workload. No browser page errors in the baseline run.

Reproduce from repository root, with local Chrome installed:

```powershell
npm run build
node --expose-gc scripts/analysis/benchmark-migration-baseline.mjs
node scripts/analysis/benchmark-gear-optimizer.mjs guardian
```

The first tool writes `.scratch/gw2combat-phase-3-baseline.json` by default (optional first argument chooses output).
The second prints JSON. The committed capture combines both outputs. These tools do not modify builds, rotations, or
benchmark manifests. Use the same workloads/settings for subsequent comparisons; do not silently change the acceptance
budget to match a result. No default-cutover performance gate is asserted here.

## Validation and handoff

- `npm run build`: passed; existing large-chunk warning recorded above.
- Focused Node run: 61 passed, including all nine profession manifest tests (120 rotation-backed presets, aggregate DPS
  within 1%, no suppressed warnings), insertion-state, simulation runners, workspace persistence, and observation
  windows.
- `npm run typecheck`, baseline script lint, and emitted-module/site checks: passed (1,333 compiled modules, ten pages,
  two runtime asset roots).
- Focused Playwright run: 14 passed, covering worker isolation, stale rotation editing, imported rotation rendering,
  build-tab isolation, persistence, and build/rotation exports.

```powershell
node --test tests/app/benchmarks/*.test.js tests/app/rotation-insertion-state.test.js tests/app/simulation-runners.test.js tests/app/build-workspace.test.js tests/platform/gw2/observation-windows.test.js
npx playwright test tests/browser/worker-isolation.spec.js tests/browser/rotation-stale-editing.spec.js tests/browser/rotation-import-rendering.spec.js tests/browser/build-tabs.spec.js --workers=1
npm run typecheck
npx eslint scripts/analysis/benchmark-migration-baseline.mjs
node scripts/build/check-dist.mjs
node scripts/build/check-site.mjs
```

The 3.2 handoff is concrete: carry the existing build across the current config-only request boundary; map actual
selected content; support the saved first-build command variants; retain provenance and report historical/current data
differences; route every caller and automatic analysis gate listed above. No engine/UI routing has changed in 3.1.
