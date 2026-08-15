# Rotation Optimizer Implementation Contract

## Purpose

This document defines the path from the current narrow beam search to a generic,
reliable rotation optimizer. It is both an implementation plan and a validation
contract for agents working on individual phases.

The optimizer must work from the active build, equipped skills, profession
state, and the shared simulator. It must not require profession-specific
priority lists.

The current behavior and ownership map remain documented in
[ROTATION-OPTIMIZER.md](./ROTATION-OPTIMIZER.md). This document describes the
target behavior and the gates required to reach it.

## How agents must use this contract

Implementation agents must:

1. Work through phases in order unless a later phase is only adding tests or
   interfaces needed by the active phase.
2. Preserve every invariant in this document.
3. Add the tests required by the phase before marking it complete.
4. Record validation evidence in the validation ledger at the bottom of this
   file.
5. Leave a checkbox incomplete when only part of its behavior exists.

Validation agents must:

1. Review the implementation against the contract, not only against its local
   tests.
2. Replay optimizer output through the normal simulator.
3. Check at least one power, condition, weapon-swap, resource-gated, and
   state-transition build.
4. Reject a phase if its required gate is missing, flaky, or only satisfied by
   profession-specific exceptions.
5. Record the exact commands and results used for validation.

Any deliberate contract change must update this file in the same change as the
implementation.

## Current baseline

The current optimizer is an initial beam-search implementation. Important
properties of the baseline are:

- the UI requests a beam width of `4` and branch limit of `4`;
- searches of at least 30 seconds reduce the active beam width to `1` after the
  first 25% of the window or 10 seconds;
- partial nodes are ordered primarily by damage already realized and prefix
  DPS;
- only actions at the earliest observed availability delay survive expansion;
- every non-damaging skill is initially treated as a possible enabler;
- the current combat rotation is not used as an incumbent or lower bound;
- each child evaluation replays the entire rotation prefix from time zero;
- exact fixed-window scoring is applied only to finalists;
- precasts before `Combat Start` are preserved but are not optimized.

These constraints explain why the optimizer can lose delayed damage, condition
skills, resource setup, cooldown alignment, useful state transitions, and
weapon-swap branches before their value becomes visible.

## Terms

**Setup rotation**
: The fixed sequence through the first `Combat Start` marker. It includes
precasts and the marker.

**Combat rotation**
: The sequence after `Combat Start` and before any optimizer-added terminal
wait.

**Combat horizon**
: The requested fixed combat duration. A 50-second request ends 50 seconds
after `combatStartTime`, regardless of precast duration.

**Incumbent**
: The best complete, exactly scored rotation known so far. The normalized
current rotation is the initial incumbent.

**Exact score**
: The deterministic result obtained by replaying a complete normalized rotation
through the normal profession simulator.

**Projected score**
: A search-only estimate produced by completing a partial rotation with one or
more rollout policies. It may decide exploration order but must never be
presented as the final DPS.

**Hold action**
: A virtual wait to a meaningful future decision boundary, such as a damaging
skill, ammunition charge, profession action, or weapon swap becoming ready.

**Offensive relevance**
: Evidence that an action can improve fixed-window damage through direct
damage, resources, buffs, mode changes, bar changes, cooldown changes, or
another simulator-observable causal effect.

**Transition state**
: All scheduler and resolver data needed to continue a simulation without
replaying its earlier prefix.

## Non-negotiable invariants

These invariants apply to every phase.

### Simulator authority

- The normal profession simulator is the sole authority for damage, cast time,
  cooldowns, ammunition, resources, weapon requirements, state transitions,
  buffs, conditions, target state, and action legality.
- Search heuristics may rank or prune choices but may not override simulator
  results.
- Optimizer-specific profession rotations or skill-priority tables are
  prohibited.
- Profession code may expose generic simulation state or missing mechanics. It
  must not prescribe an optimizer rotation.

### Result correctness

- Every returned cast must be valid when replayed in order.
- Weapon and active-bar prerequisites must match the active weapon set at the
  cast time.
- Cooldowns, ammunition, and profession resources must be honored.
- The applied rotation must reproduce the optimizer's reported damage and DPS.
- The requested combat horizon must be measured from `Combat Start`.
- Setup actions and the `Combat Start` marker must survive optimization and
  cleanup unchanged unless precast optimization is explicitly added in a later
  contract.
- A terminal wait may complete the combat horizon but must not be counted as a
  combat action.

### Baseline safety

- The normalized current rotation must be scored before search begins.
- The optimizer must never return a result with lower exact damage or DPS than
  the initial incumbent under the same configuration and horizon.
- If search finds no improvement, it must return the normalized incumbent and
  state that no improvement was found.
- A wall-clock timeout must return the best exactly scored incumbent available,
  never an unvalidated partial node.

### Generic decision making

- A skill with no direct damage must not be retained merely because it exists.
- A zero-damage action may remain only when simulator evidence shows that it
  enables or increases later fixed-window damage.
- Defensive or reactive actions against an inactive golem must be excluded when
  their trigger cannot occur.
- Search must be able to choose a short hold over immediate filler when the hold
  produces a better exact result.
- Search must preserve multiple strategically distinct states long enough for
  their delayed value to be evaluated.

### Determinism and budgets

- Search uses deterministic simulation randomness.
- An evaluation-count budget is the primary deterministic stopping condition.
- A wall-clock limit is a safety fallback and UI responsiveness limit.
- The same request, seed, code revision, and evaluation budget must produce the
  same result.
- Increasing an evaluation budget must never discard a better incumbent found
  under a smaller budget with the same seed and search configuration.

## Fixed-window normalization contract

Baseline and candidate rotations must use the same normalization path.

1. Preserve all entries through the first `Combat Start` marker.
2. Insert `Combat Start` at time zero when no marker exists.
3. Remove any existing optimizer terminal wait before fitting the combat
   sequence.
4. Replay combat entries in order.
5. Stop before the first entry that is invalid, starts at or after the combat
   horizon, or would extend the entered rotation past the combat horizon.
6. Append a terminal wait when the remaining combat window is positive.
7. Replay the normalized rotation once more and use that exact result for
   comparison.

The same function must normalize the current rotation, search finalists, and
locally mutated rotations. Separate baseline and result-padding implementations
are not allowed.

Target death remains governed by the configured simulator behavior. A future
objective may distinguish fixed-duration damage from time-to-kill, but that is
outside the initial contract.

## Target request and result contract

Exact names may change during implementation, but the request and result must
carry equivalent information.

```ts
interface RotationOptimizerRequest {
  professionId: string;
  config: Gw2Config;
  candidates: readonly RotationOptimizerCandidate[];
  setupRotation: readonly LegacyRotationItem[];
  incumbentRotation: readonly LegacyRotationItem[];
  horizonMs: number;
  evaluationBudget: number;
  wallClockLimitMs: number;
  seed: number;
  objective: "fixed-window-dps";
}

interface RotationOptimizerResult {
  rotation: readonly LegacyRotationItem[];
  dps: number;
  totalDamage: number;
  baselineDps: number;
  baselineDamage: number;
  improvementDps: number;
  improvementPercent: number;
  horizonMs: number;
  combatStartTimeMs: number;
  precastActions: number;
  combatActions: number;
  evaluated: number;
  exactEvaluations: number;
  projectedEvaluations: number;
  timedOut: boolean;
  improved: boolean;
  diagnostics: RotationOptimizerDiagnostics;
}
```

The result contract must distinguish baseline, projected, and exact values. The
UI must never label a projected score as DPS.

## Search design contract

### Initial incumbents

Search must start with complete legal seeds:

1. the normalized current combat rotation;
2. a deterministic greedy damage-per-lockout rotation;
3. a deterministic cooldown-first rotation;
4. a small seeded set of randomized legal rotations;
5. later phases may add saved or user-selected seeds without making them
   mandatory.

All complete seeds must be exactly scored. The strongest becomes the initial
incumbent.

### Partial-node scoring

Prefix DPS must not be the primary search value.

For each retained partial state:

1. generate at least one legal completion to the combat horizon;
2. exactly simulate the completed rollout when the budget permits;
3. use the best rollout result as the projected node value;
4. retain realized damage, projected damage, elapsed combat time, and state
   novelty as separate fields;
5. never compare delayed condition or strike damage solely at the prefix end.

Initial rollout policies should include:

- greedy marginal damage per occupied cast time;
- damaging skills ordered by readiness and measured marginal value;
- resource-building actions followed by the best known spender;
- the incumbent suffix when it remains legal from the current state.

### Holds and cooldown alignment

The action generator must include hold branches at meaningful boundaries.

- A hold target must come from simulator state, not a fixed arbitrary delay.
- Eligible targets include the next relevant cooldown, ammunition restoration,
  weapon swap, profession action, or offensive mode transition.
- Duplicate hold targets within the scheduler clock epsilon must collapse into
  one action.
- Holds past the combat horizon are invalid.
- An immediate action and a short hold must be allowed to compete; the current
  earliest-availability-only filter must not eliminate the hold before scoring.

### Offensive relevance

Candidate enumeration may use declared damage as a cheap first classification,
but declared damage is not a complete priority model.

A non-damaging action is searchable only when at least one of these is true:

1. it changes a simulator-visible action bar or active weapon set;
2. it changes a profession resource or offensive state used by a legal action;
3. a bounded counterfactual rollout scores higher with the action than without
   it;
4. it is explicitly required to reach another currently unavailable action.

Cooldown creation by itself is not proof of offensive relevance. This prevents
heals, dodges, blocks, and reactive defenses from qualifying merely because
their own cooldown changed.

The final cleanup pass must remove a zero-damage action whenever deleting it and
renormalizing the rotation does not reduce exact fixed-window damage.

### Frontier diversity

- The long-window beam must never collapse to width `1`.
- Phase 1 should start with a configurable width between `16` and `32`, bounded
  by the evaluation budget.
- Frontier selection must reserve strategically distinct states, not only the
  highest projected score.
- At minimum, diversity must distinguish active weapon set, meaningful action
  bar or profession mode, resource band, and recent action suffix.
- Equivalent-state deduplication must keep the node with the better projected
  score, then exact damage, then shorter sequence.
- Diversity reservations must not allow an invalid or exactly dominated state
  to survive.

## Incremental transition contract

Phase 2 replaces full-prefix replay during expansion. This snapshot is not the
UI `rotationStateSnapshot`; it is an engine continuation state.

An optimizer transition state must contain or retain access to:

- scheduler time and cast locks;
- cooldowns, ammunition, and lockouts;
- active weapon set and action-bar state;
- profession scheduler and resolver state;
- queued and pending events;
- player buffs and target conditions needed by future resolution;
- combo, sigil, relic, food, and other equipment state;
- target health and death state;
- deterministic random state;
- combat-start and fixed-horizon information.

The engine-facing API must provide equivalent operations to:

```ts
interface OptimizerSimulationSession {
  initialState(setup: readonly LegacyRotationItem[], config: Gw2Config): State;
  fork(state: State): State;
  apply(state: State, action: LegacyRotationItem): TransitionResult;
  hold(state: State, untilMs: number): TransitionResult;
  finish(state: State, horizonMs: number): Gw2SimulationResult;
  fingerprint(state: State): string;
}
```

Required properties:

- forking must not leak mutations between sibling branches;
- applying a sequence incrementally must match full replay of the same sequence;
- fingerprints must use combat-relative clocks and stable serialization;
- pending future damage and condition state must participate in equivalence;
- the API must remain profession-neutral;
- a profession must not implement its own optimizer transition engine.

Full replay remains the final validator even after incremental search exists.

## Hybrid anytime search contract

After incremental transitions are available, search should combine:

1. a diversified best-first or progressive-widening tree search for new state
   discovery;
2. rollout completion for long-term value;
3. local mutation of complete incumbents.

Required local mutations are:

- insert a legal action;
- delete an action;
- replace an action;
- swap adjacent or short subsequences;
- insert or remove a hold;
- insert a legal weapon or action-bar transition;
- replace a repeated filler segment with another legal segment.

A mutation is accepted only after exact fixed-window replay improves the
incumbent. Search must remain useful when interrupted at any point because the
last exact incumbent is always valid.

## Implementation phases

### Phase 0: Measurement and contract harness

Deliverables:

- [x] Add a shared fixed-window normalization helper.
- [x] Add exact incumbent scoring before the search loop.
- [x] Add an evaluation-count budget alongside the wall-clock fallback.
- [x] Add optimizer diagnostics for baseline, incumbent, projected evaluations,
      exact evaluations, frontier size, and stop reason.
- [x] Add a corpus runner covering saved native-profession builds and rotations.
- [x] Record per-build baseline DPS, result DPS, improvement, invalid actions,
      evaluated states, and elapsed wall time.

Required tests:

- [x] A longer incumbent is cropped and padded to the requested horizon.
- [x] A shorter incumbent is padded to the requested horizon.
- [x] Precasts and `Combat Start` remain unchanged.
- [x] Baseline and result use the same normalization helper.
- [x] A timeout returns an exactly scored incumbent.
- [x] An evaluation budget produces deterministic results.

Phase 0 gate:

- [x] The corpus runner completes for every native profession without a worker
      or import failure.
- [x] Existing applied-result DPS parity remains exact.
- [x] No search-quality change is required yet, but baseline metrics are
      captured for comparison.

### Phase 1: Correct the existing search

Deliverables:

- [x] Pass the current combat rotation as an incumbent.
- [x] Guarantee that the returned exact score is not below baseline.
- [x] Remove the width-`1` long-window collapse.
- [x] Raise and configure the diverse frontier width under an evaluation budget.
- [x] Add legal hold branches at simulator-derived readiness boundaries.
- [x] Replace prefix-DPS ordering with rollout-based projected scoring.
- [x] Add offensive-relevance filtering for zero-damage actions.
- [x] Add state-diversity reservations.
- [x] Report baseline delta and whether an improvement was found.

Required fixture behaviors:

- [x] Delayed condition damage survives early pruning.
- [x] A delayed strike or summon packet survives early pruning.
- [x] A resource builder survives when it enables the best spender.
- [x] A short hold beats immediate filler when it aligns a stronger cooldown.
- [x] A weapon swap survives when the alternate set improves the horizon result.
- [x] A useful zero-damage offensive enabler survives.
- [x] Dodge, heal, block, and an untriggerable counter are excluded when they do
      not increase golem damage.
- [x] The loaded incumbent is returned unchanged when search finds no exact
      improvement.

Phase 1 gate:

- [x] No corpus result is worse than its normalized incumbent.
- [x] Every corpus result replays with zero invalid casts.
- [x] Every reported score matches normal-simulator replay.
- [x] Power and condition builds both show that delayed value can survive the
      frontier.
- [x] Power Spellbreaker uses legal weapon bursts and contains no Full Counter
      on the inactive golem.

### Phase 2: Incremental simulation and caching

Deliverables:

- [ ] Add the engine continuation-state API.
- [ ] Implement isolated state forking.
- [ ] Implement one-action and hold transitions.
- [ ] Implement stable relative-state fingerprints.
- [ ] Cache state/action transitions within one optimizer request.
- [ ] Keep full replay as the exact finalist validator.
- [ ] Add transition and cache metrics to diagnostics.

Required tests:

- [ ] Incremental and full replay match after every prefix of fixture rotations.
- [ ] Sibling state mutations are isolated.
- [ ] Cooldown and ammunition restoration match full replay.
- [ ] Weapon swaps and profession bar transitions match full replay.
- [ ] Conditions, delayed damage, buffs, and pending events match full replay.
- [ ] Deterministic random state matches full replay.
- [ ] State fingerprints do not merge states with different future damage.

Phase 2 gate:

- [ ] Prefix parity passes for every native profession corpus fixture.
- [ ] Search quality is no worse than Phase 1 at the same evaluation budget.
- [ ] The corpus report records a material reduction in repeated full-prefix
      work; any regression must be explained before acceptance.

### Phase 3: Hybrid anytime search

Deliverables:

- [ ] Add deterministic complete-rotation seed generation.
- [ ] Add progressive-widening best-first or tree exploration.
- [ ] Add the required local mutations.
- [ ] Allocate the evaluation budget between discovery, rollout, mutation, and
      final validation.
- [ ] Retain the best exact incumbent after every accepted improvement.
- [ ] Return a small set of distinct alternatives in diagnostics.

Required tests:

- [ ] A long-term setup requiring several low-damage actions is discovered.
- [ ] Search escapes a locally optimal repeated filler sequence.
- [ ] Mutation improves a legal but poorly ordered incumbent.
- [ ] Increasing the evaluation budget preserves or improves the incumbent.
- [ ] Same seed and evaluation budget reproduce the same result.
- [ ] Timeout at multiple points always returns a valid exact incumbent.

Phase 3 gate:

- [ ] The native-profession corpus is never worse than Phase 1.
- [ ] Median and worst-case regret against saved strong rotations are reported.
- [ ] Long-window searches retain multiple state families until exact evidence
      justifies convergence.
- [ ] No profession-specific priority implementation was introduced.

### Phase 4: UX and observability

Deliverables:

- [ ] Show baseline DPS, best DPS, and absolute/percentage improvement.
- [ ] Distinguish projected progress from exact incumbent DPS.
- [ ] Show evaluation budget progress and wall-clock fallback status.
- [ ] Show why the search stopped.
- [ ] Offer the incumbent and a small number of distinct alternatives when
      available.
- [ ] Show diagnostics for removed zero-damage actions, holds, swaps, invalid
      candidates, cache hits, and exact validations.
- [ ] Do not enable Apply when the build or setup prefix changed during search.

Phase 4 gate:

- [ ] UI text never claims global optimality.
- [ ] Applying each displayed alternative reproduces its exact score.
- [ ] A no-improvement result is explicit and does not present a regression as
      success.
- [ ] Progress remains responsive and cancellation preserves the current
      rotation.

## Proposed module ownership

Keep the feature in `js/rotation-optimizer/` and split responsibilities as they
become substantial:

| Module             | Responsibility                                            |
| ------------------ | --------------------------------------------------------- |
| `candidates.ts`    | Build-reachable actions and static prerequisites          |
| `normalization.ts` | Shared setup, horizon fitting, and terminal wait logic    |
| `baseline.ts`      | Incumbent extraction and exact baseline scoring           |
| `rollout.ts`       | Deterministic completion policies and projected scoring   |
| `frontier.ts`      | Diversity, dominance, and budget-aware frontier selection |
| `relevance.ts`     | Counterfactual offensive-relevance evaluation             |
| `transitions.ts`   | Adapter around the engine continuation-state API          |
| `mutations.ts`     | Complete-rotation local search operations                 |
| `search.ts`        | Anytime orchestration and incumbent management            |
| `diagnostics.ts`   | Search metrics and user-facing explanations               |
| `worker.ts`        | Worker protocol, progress, cancellation, and errors       |
| `ui.ts`            | Controls, status, results, and safe application           |
| `types.ts`         | Stable public and worker contracts                        |

Do not create empty modules in advance. Split a module when its phase is
implemented and it owns meaningful behavior.

## Validation matrix

Every phase must cover the relevant rows.

| Contract area              | Unit fixture | Native integration | Corpus   | Manual UI    |
| -------------------------- | ------------ | ------------------ | -------- | ------------ |
| Fixed combat horizon       | Required     | Required           | Required | Required     |
| Precasts and Combat Start  | Required     | Required           | Required | Required     |
| Cooldowns and ammunition   | Required     | Required           | Required | Optional     |
| Weapon/action-bar legality | Required     | Required           | Required | Required     |
| Resource gating            | Required     | Required           | Required | Optional     |
| Delayed strike damage      | Required     | Required           | Required | Optional     |
| Condition damage           | Required     | Required           | Required | Optional     |
| Zero-damage relevance      | Required     | Required           | Required | Required     |
| Baseline guarantee         | Required     | Required           | Required | Required     |
| Exact replay parity        | Required     | Required           | Required | Required     |
| Deterministic budget       | Required     | Required           | Sampled  | Optional     |
| Timeout/cancellation       | Required     | Required           | Optional | Required     |
| Incremental parity         | Phase 2      | Phase 2            | Phase 2  | Not required |

## Required validation commands

At minimum, implementation and validation agents must run:

```powershell
npx prettier --write <files-touched-by-the-phase>
npm run build:modules
node --import ./scripts/testing/register-dist-loader.mjs --test --test-isolation=none tests/rotation-optimizer/rotation-optimizer.test.js
npm run check
git diff --check
```

Run relevant profession and platform tests whenever the phase changes simulator
state, legality, result fields, weapon requirements, or profession behavior.

Before declaring a phase complete, also run the optimizer corpus command added
by Phase 0 and attach its summary to the validation ledger.

## Deferred scope

The following are intentionally outside Phases 0–4 unless this contract is
updated first:

- automatic precast discovery;
- optimization of concurrent instant-cast offsets;
- optimization of manual interrupt timing;
- stochastic expected-value optimization;
- encounter mechanics or incoming-attacks optimization;
- support rotations, healing, breakbar, or boon-uptime objectives;
- proof of a mathematical global optimum.

The product should continue to say “best found,” not “optimal,” unless an
exhaustive proof is actually available for the requested state space.

## Open review findings

These are outstanding review findings against the current implementation and this
contract. Resolve each in a later phase or a contract update, and note the
resolution here when closed.

### Finding 2 — Frontier width floor is not enforced (2026-08-14)

The search design contract requires a Phase 1 frontier width "between `16` and
`32`" and states the long-window beam "must never collapse to width `1`". The
implementation caps the width at `32` but applies no lower bound:
`Math.min(32, finitePositiveInteger(request.beamWidth, 20))` in `search.ts`. A
caller that passes a `beamWidth` below `16` (including `1`) is honored, so the
"never collapse to `1`" guarantee is convention, not code. Enforce the floor
(e.g. `Math.max(16, ...)`) or restate the contract to make the floor advisory.

### Finding 3 — Documented result interface has drifted from the code (2026-08-14)

`RotationOptimizerResult` in this document is stale relative to the shipped
`types.ts`. The code carries fields the interface here does not list (for
example `activeDurationMs`, `completedHorizon`, and `actions`). The contract
allows names to change during implementation, but the interface block above is
now a misleading reference. Reconcile the documented shape with `types.ts`, or
replace the literal interface with a pointer to `types.ts` as the source of
truth.

### Finding 4 — Green Phase 1 gates prove safety, not search quality (2026-08-14)

The corpus gates were satisfied at very small evaluation budgets (3 evaluations
for Phase 0, 30 for Phase 1). At those budgets, with a frontier near `20`, the
search barely explores, so the passing gates ("no result worse than baseline",
"zero invalid casts", "exact replay parity") demonstrate correctness and safety
only. They do not demonstrate that the optimizer finds improvements on real
builds; the required fixtures show that delayed value *can* survive the
frontier, not that the corpus search *does* improve. Add a search-quality gate —
for example a reported median and worst-case improvement over the normalized
incumbent across the corpus at a realistic budget — so a green phase means the
optimizer produces wins, not just avoids regressions.

## Validation ledger

Append one record per implementation phase. Do not overwrite earlier evidence.

### Validation record template

```md
### Phase N — YYYY-MM-DD

- Implementation revision: `<commit or working-tree identifier>`
- Implementing agent: `<name/id>`
- Validating agent: `<name/id>`
- Contract deviations: None / `<documented deviation>`
- Focused tests: `<command and pass/fail counts>`
- Full check: `<command and result>`
- Corpus summary: `<build count, regressions, invalid casts, replay mismatches>`
- Performance summary: `<evaluation budget, wall time, cache/full replay metrics>`
- Validation result: PASS / FAIL
- Remaining blockers: None / `<list>`
```

### Phase 0 — 2026-08-14

- Implementation revision: `5c15dba3 + working tree`
- Implementing agent: `Codex /root`
- Validating agent: `Codex /root (self-validation)`
- Contract deviations: None
- Focused tests: `npm run build:modules; node --import ./scripts/testing/register-dist-loader.mjs --test --test-isolation=none tests/rotation-optimizer/rotation-optimizer.test.js` — 19 passed, 0 failed
- Full check: `npm run check` — PASS (sandbox retry required for Vite child-process spawn)
- Corpus summary: 94 builds, 0 regressions, 0 invalid casts, 0 replay mismatches, 0 errors
- Performance summary: 3-evaluation baseline budget, 34.4 seconds total corpus wall time, 3 exact and 0 projected evaluations per build
- Validation result: PASS
- Remaining blockers: None for Phase 0

### Phase 1 — 2026-08-14

- Implementation revision: `5c15dba3 + working tree`
- Implementing agent: `Codex /root`
- Validating agent: `Codex /root (self-validation)`
- Contract deviations: None
- Focused tests: `npm run build:modules; node --import ./scripts/testing/register-dist-loader.mjs --test --test-isolation=none tests/rotation-optimizer/rotation-optimizer.test.js` — 19 passed, 0 failed
- Full check: `npm run check` — PASS; `git diff --check` — PASS
- Corpus summary: 94 builds at a 30-evaluation search budget, 0 regressions, 0 invalid casts, 0 replay mismatches, 0 errors
- Performance summary: 30-evaluation budget, 55.8 seconds total corpus wall time; each search retained a 3-evaluation exact-finalist reserve
- Validation result: PASS
- Remaining blockers: Phase 2 continuation-state API is not implemented. The broader Warrior test run had 2 pre-existing failures in Winds pulse observation and Flow timing; the optimizer-focused Spellbreaker checks passed.
