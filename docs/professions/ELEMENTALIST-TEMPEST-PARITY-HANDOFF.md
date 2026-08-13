# Elementalist Tempest Parity Handoff

Handoff date: 2026-08-13

## Objective

Finish migration parity for all 13 Tempest builds from rotation execution through per-ability DPS metrics. Aggregate DPS alone is not sufficient: named ability strike/condition components, condition applications, effective stack-seconds, and material rotation timing must remain visible.

## Non-negotiable constraints and decisions

- Do not change shared resolver or scheduler behavior without explicit user confirmation.
- Do not add an Elementalist-only workaround for behavior that belongs in the shared engine.
- Relic of Nourys is generic shared equipment for every profession, not Elementalist-only.
- ELM-701 is closed without implementation. Keep native per-application condition ticks and fractional final damage.
- ELM-703 is closed without implementation. Keep native Nourishment no-banking and life-siphon classification.
- ELM-702 and ELM-704 are the only remaining shared behavior candidates. Neither has been approved yet.
- Continue reporting accepted ELM-701/703 ability differences; do not hide them by checking aggregate DPS only.

## Repository and baseline

- Workspace: `D:\gw2-combat-simulator`
- Branch: `ele-migration`
- HEAD and upstream at handoff: `dd91666ffed99652391dd71b6f94106d8a8fe507`
- Ignored reference clone: `reference-repos/Elementalist-Simulator`
- Reference commit: `e96714400af1fae655eda701e7f9c975db948783`
- `.gitignore` already excludes `reference-repos/Elementalist-Simulator/`.

The worktree is intentionally dirty. Preserve unrelated user work in:

- `js/professions/thief/specializations/deadeye/skills.ts`
- `.claude/`

Do not revert, format, or include those paths in Elementalist work.

## Completed work

The current HEAD contains the main native Elementalist corrections, generic Nourys rules, and the three-way reference/local-legacy/native audit. Relevant areas include:

- `js/professions/elementalist/core/resolver.ts`
- `js/professions/elementalist/core/rules.ts`
- `js/professions/elementalist/specializations/tempest/rules.ts`
- `js/platform/gw2/relic-rules.ts`
- `js/platform/gw2/query.ts`
- `scripts/audit/compare-power-tempest-reference.mjs`

Uncommitted Elementalist/audit work at handoff:

- `Builds/elementalist/b-power-tempest-sword.json`
- `docs/professions/ELEMENTALIST-NATIVE-MIGRATION-AUDIT.md`
- `docs/professions/POWER-TEMPEST-REFERENCE-AUDIT.md`
- `docs/professions/ELEMENTALIST-TEMPEST-PARITY-HANDOFF.md`
- `js/platform/gw2/damage-modifier-buckets.ts`
- `js/professions/elementalist/build.ts`
- `scripts/audit/compare-power-tempest-reference.mjs`
- `tests/platform/gw2/modifier-rules.test.js`
- `tests/professions/elementalist/native-mechanics.test.js`
- `tests/professions/elementalist/power-tempest-sword-preset.test.js`

Those changes do the following:

- Preserve an explicitly selected `evtc` elemental profile when migrating a saved snapshot.
- Mark the local Power Sword preset as EVTC and validate all nine Flame Barrage commands at twelve-second intervals.
- Correct the Power Sword Electric Discharge expectation to 23; the target dies at 98.525s before the final Air Attunement scheduled at 98.849s.
- Keep generic Nourys additive damage active when a profession packet excludes weapon sigils.
- Classify every direct native-versus-legacy ability failure by diagnosed cause.
- Update both audit documents with current results and shared-policy decisions.

Twelve local Tempest build/rotation fixture pairs match upstream exactly. Local Power Sword intentionally differs because it uses the EVTC Fire Elemental profile and explicit Flame Barrage commands. The upstream audit continues to run the upstream fixed-reference fixture for a valid engine comparison.

## Current audit result

Run:

```powershell
node --import ./scripts/testing/register-dist-loader.mjs scripts/audit/compare-power-tempest-reference.mjs --summary
```

All 13 native runs have zero warnings. Aggregate native DPS is within -0.739% to +1.159% of upstream and within -0.739% to +0.982% of local legacy.

There are 69 direct native-versus-local-legacy per-build ability component failures:

- 58 `condition-tick-cadence` rows: accepted ELM-701 difference.
- 9 `critical-food-policy` rows: accepted ELM-703 difference.
- 2 `critical-sigil-causality` rows: open ELM-702 work.
- 0 unclassified rows.

Condition application counts and effective stack-seconds match for every ability except Sigil of Earth in Condi Alac Scepter: legacy has 39 applications and 467.688 stack-seconds; native has 40 and 479.680.

`--check` currently exits 1 because it remains deliberately strict and reports accepted differences as failures. Do not weaken or remove the per-ability diagnostics. If a green actionable gate is needed, add a separate mode that still prints accepted-cause counts and fails on ELM-702, ELM-704, or any unclassified/new divergence.

## Remaining candidate: ELM-702 critical sigil causality

Evidence:

- Power Hammer has 32 native Sigil of Air procs versus 31 in reference/legacy.
- Hammer orb events are scheduled ahead of time. Grand Finale cancels future orb packets, but a critical sigil derived from a future packet can already have been materialized.
- Condi Alac Scepter has 40 native Sigil of Earth applications versus 39 legacy. Its first sequence drift occurs when expected critical progress is evaluated from scheduler-side facts.

Current ownership:

- `js/platform/gw2/scheduler/proc-materializer.ts` calls `resolveCriticalTrigger` and materializes critical sigils from scheduled damage events.
- `js/platform/gw2/scheduler/critical-facts.ts` owns scheduler-side deterministic critical progress and stochastic outcomes.
- `js/platform/gw2/scheduler/sigil-proc-engine.ts` owns sigil ICDs and effect emission.
- `js/platform/gw2/resolver/equipment-reactions.ts` already demonstrates shared post-resolution equipment reactions for critical food.
- Resolver equipment state currently exposes only `sigil.severanceUntil` in `js/platform/gw2/resolver/extensions.ts` and `js/platform/gw2/types.d.ts`; a post-resolution implementation needs isolated critical progress and ICD state.

Recommended behavior, only after explicit approval:

1. Move only critical-triggered Air/Earth/Torment evaluation to a shared `damage.resolved` reaction.
2. Trigger from the canonical resolved critical result so cancelled/non-resolved hits cannot proc.
3. Preserve deterministic expected-progress behavior and seeded stochastic behavior.
4. Resolve the active weapon set at the hit timestamp.
5. Keep swap, control, strike, Doom, and Severance behavior unchanged unless evidence requires otherwise.
6. Avoid duplicating sigil data/effect policy between scheduler and resolver; extract reusable generic rules if necessary.
7. Re-run the Earth trace after the causal move. Do not assume it fixes the 40-versus-39 count.

Required regressions:

- Existing critical-sigil tests in `tests/platform/gw2/resolver-architecture.test.js` must continue passing in deterministic and seeded stochastic modes.
- Add a generic cancelled-hit test proving a removed damage packet cannot produce Air/Earth/Torment.
- Extend the Elementalist Hammer/Grand Finale test in `tests/professions/elementalist/native-mechanics.test.js` to cover sigil causality.
- Run all `tests/platform/gw2/*.test.js`, not only Elementalist tests.

## Remaining candidate: ELM-704 concurrent rotation scheduling

Evidence from Condi Alac Pistol:

- Rotation index 113 Scorching Shot runs from 62.842s to 63.362s.
- A concurrent Feel the Burn! requests 63.323s but is unavailable until 63.509s.
- Reference schedules the next serial Scorching Shot at 63.362s and the delayed concurrent action at 63.509s.
- Native advances its single clock to the delayed concurrent action and then starts the next serial Scorching Shot at 63.509s, creating 147ms drift.

Current ownership:

- `js/platform/engine/scheduler.ts` executes normalized commands through one monotonically advancing `state.time`.
- `orderConcurrentSiblings` sorts concurrent siblings by projected availability, but `cast()` advances the global clock while waiting.
- The next serial command therefore cannot be evaluated at its earlier serial-lane time.
- `tests/platform/engine/scheduler-temporal.test.js` currently locks the existing behavior in `a concurrent instant waits until its finite cooldown expires`: the delayed concurrent action also delays the following serial cast.

Recommended behavior, only after explicit approval:

1. Treat a delayed concurrent command as a queued intent that does not advance the serial cast lane.
2. Preserve chronological state/task processing; do not move `state.time` backwards.
3. Execute whichever becomes due first: the next serial-lane command or queued concurrent intent.
4. Preserve rotation indices and the shared anchor for consecutive concurrent siblings.
5. Update the existing temporal test only after the behavior decision is approved.
6. Add the exact Condi Alac Pistol 63.362s/63.509s regression.
7. Run the entire scheduler temporal suite and cross-profession rotation tests.

This likely requires event-driven command arbitration rather than a local `Math.max` change. A narrow Elementalist scheduler hook is not acceptable.

## Verification already completed

These passed before the handoff classification/document edits:

```powershell
npm run build
npm run typecheck
```

- 91 focused Elementalist/relic/modifier tests passed.
- All 132 `tests/platform/gw2/*.test.js` tests passed.
- Generic Nourys cadence and additive-bucket tests passed.
- Production Vite build passed with only the existing chunk-size warning.

After any new edit, format only touched supported files as required by `AGENTS.md`:

```powershell
npx prettier --write <touched-files>
```

Then run:

```powershell
npm run build
npm run typecheck
node --import ./scripts/testing/register-dist-loader.mjs --test --test-isolation=none tests/professions/elementalist/elementalist.test.js tests/professions/elementalist/native-legacy-parity.test.js tests/professions/elementalist/native-mechanics.test.js tests/professions/elementalist/native-skill-selection.test.js tests/professions/elementalist/power-tempest-sword-preset.test.js tests/platform/gw2/modifier-rules.test.js tests/platform/gw2/relic-groups.test.js
$gw2Tests = Get-ChildItem -Path "tests/platform/gw2" -Filter "*.test.js" | ForEach-Object { $_.FullName }
node --import ./scripts/testing/register-dist-loader.mjs --test --test-isolation=none $gw2Tests
node --import ./scripts/testing/register-dist-loader.mjs scripts/audit/compare-power-tempest-reference.mjs --summary
node --import ./scripts/testing/register-dist-loader.mjs scripts/audit/compare-power-tempest-reference.mjs --check
```

The final `--check` is expected to fail until its strict-versus-actionable contract is resolved; inspect the cause counts rather than treating that exit alone as a regression.
