# Rotation optimizer

The local Node CLI discovers rotations from an empty combat session. It holds the supplied build's traits, equipment,
weapons, equipped skills and modifiers fixed. The first validated preset is
`data/gw2/builds/guardian/b-power-luminary.json`.

Run from the repository root (Node 24.11 or newer, dependencies installed):

```powershell
npm run optimize:rotation -- --build data/gw2/builds/guardian/b-power-luminary.json --duration 20 --budget 100 --beam-width 4 --search-seed 1 --combat-seeds 11,12 --validation-seeds 1011,1012 --output-dir .scratch/optimizer-20s
```

After compiling once, call the script directly:

```powershell
node scripts/analysis/optimize-rotation.mjs --duration 20 --budget 100 --beam-width 4 --output-dir .scratch/optimizer-20s
node scripts/analysis/optimize-rotation.mjs --duration 20 --budget 1000 --target-dps 41395 --output-dir .scratch/optimizer-target
```

## Inputs and console output

- `--build`: existing saved build JSON, loaded through the profession application adapter, attribute recalculation, and
  simulation-config pipeline. Defaults to Power Luminary. A rotation inside the build is deliberately ignored.
- `--duration`: positive combat seconds, default 20.
- `--budget`: maximum complete candidate evaluations, minimum 4, default 100. Each evaluates all training seeds.
  Continuations, comparisons and held-out validation add engine executions; the report counts search replay executions
  separately.
- `--beam-width`: positive survivor count, default 4.
- `--search-seed`: unsigned 32-bit seed for action ordering, continuation policies and mutations, default 1.
- `--combat-seeds`: comma-separated comparison seeds, default `11,12`.
- `--validation-seeds`: disjoint held-out seeds, default `1011,1012`. Each set requires at least two unique seeds.
- `--target-dps`: positive numeric target, defaulting to `benchmarkDps` from the manifest entry matching the exact build
  path. Builds without a manifest target maximize damage through the entire budget. An explicit value overrides the
  manifest.
- `--output-dir`: default `.scratch/rotation-optimizer`. Writes `rotation.json` and `report.json`.
- `--baseline-rotation`: optional existing rotation JSON, read only for comparison after search. By default no saved
  reference rotation is opened.

Console status goes to stderr only after completed candidate evaluations: best fixed-window DPS, target, signed gap,
completed evaluation count and elapsed time. Improvements print immediately; other updates print at most once per
second. There are no action, phase or export logs. Stdout contains a final JSON summary with training and held-out DPS,
goal status and output directory. Logging never consumes random numbers or changes the evaluation budget.

## Objective and comparisons

The objective is mean **total player damage during [0, duration]**, including eligible delayed hits and condition
payouts at the inclusive endpoint. Reported optimizer DPS is damage divided by the full configured duration. It does not
use the ordinary simulator's first-hit DPS denominator. Environment damage is excluded.

Combat starts at zero, player health stays at 100%, and target health is set to `Number.MAX_SAFE_INTEGER` so the target
survives. Other build/scenario assumptions are retained. There are no free precasts or cooldown resets. All comparisons
use the same config, target, duration and seed sets.

The manifest contributes **only a scalar DPS aspiration**, never rotation actions, ordering or timing. Search stops when
the incumbent strictly exceeds that target on every training seed, or the evaluation budget runs out. Held-out seeds are
evaluated once afterward; `validated-target-exceeded` requires every training and held-out sample to exceed the target.
A failed held-out check is reported without feeding those results back into search. Signed gaps are target minus mean
DPS; negative values exceed the target. This checks the configured seeds, not statistical significance.

For the default build the manifest target is 41,395 DPS. Its human benchmark uses a different encounter setup from the
optimizer's cold-start, immortal-target fixed window. Crossing the scalar target, especially in a short burst window,
does **not** establish a human-benchmark improvement. A matched benchmark comparison requires matching encounter health,
duration/scoring convention and precombat rules; the manifest alone does not describe all of these.

The simple baseline chooses legal weapon-slot-one attacks and waits when necessary. Existing preset comparisons remove
combat-start markers and cooldown resets, keep the other commands including setup/off-target casts, and trim to an
endpoint-safe prefix. This is explicitly a **cold-start adaptation**, not the preset's published benchmark. Its
adjustment, removed-control count and per-seed warnings are recorded. Unsupported or mistimed existing commands remain
visible as warnings; they are never silently suppressed.

The exported rotation includes a combat-start marker and terminal waiting so the existing JSON importer and ordinary
simulation observe the full endpoint. The CLI reimports and replays the export for every training/held-out seed before
writing it. The application's ordinary DPS display still follows its existing first-hit denominator; compare
`totalDamage` or the report's fixed-window DPS.

## Engine session interface

`initializeGw2Combat` shares preparation and the event loop with `simulateGw2`. It starts without authored actions:

```js
import { initializeGw2Combat } from '#gw2/platform/index.js';

const combat = initializeGw2Combat({ profession, config, durationMs: 20_000 });
const observation = combat.observe();
const choices = combat.actions();
combat.apply(choices[0]);

const checkpoint = combat.snapshot();
const branch = checkpoint.resume(); // independently mutable continuation
const anotherBranch = combat.clone();
console.log(branch.time, branch.score().totalDamage, branch.done);
```

`observe()` exposes the detached planning projection plus damage and endpoint status. `actions()` returns detached legal
casts and an advancing wait. `apply()` executes through the next decision, settling all same-time work first. `time` and
`done` avoid allocating full observations during rollouts. `rotation()` returns canonical importer commands for the
decisions made so far. `score()` reads accumulated authoritative damage.

`planningState` remains an observation, not a checkpoint. A checkpoint is an opaque in-memory object with `resume()`; it
is neither a JSON save file nor portable between engine revisions. It copies the connected mutable graph, preserving
aliases between queued events and conditions, heap ordering/frontier/cancellations, cast reservations and cursor lanes,
resources and accrual anchors, buffs, summons, trait/equipment ICDs, effect-reaction groups, flip identities and RNG
stream positions. Controller/query closures are rebuilt against each branch's runtime. `SnapshotFacts` keeps weakly
owned Guardian cast facts and shared resource/flip metadata attached during graph copying. Selectors never receive
checkpoint internals, queued future events or RNG positions.

Guardian is currently the only enabled snapshot family. Luminary is the validated search build; focused Firebrand tests
also exercise resource restoration. Other families explicitly fail initialization until their private mutable state is
audited and included. Search itself contains no Guardian/Luminary mechanics or skill IDs.

## Search and restrictions

Beam expansion clones a prefix for each legal choice, applies it in the engine, and simulates a continuation through the
same endpoint. Static declaration-based priorities and seeded exploration provide different continuation policies.
Complete rotations are replayed on common combat seeds; mean final damage ranks candidates. Partial damage/DPS never
ranks the beam. Survivors are diversified by active weapon set and last action. Exhausted beams restart from empty. The
best valid complete result is retained throughout.

Half of the maximum candidate budget goes to beam exploration. The remaining budget refines the best complete rotation
by retaining a random prefix of its actual engine decisions, choosing a different legal action or wait, and regrowing
the suffix. This changes action ordering, waits and transition timing without carrying obsolete cooldown assumptions
into edited commands. A 15% chance of starting the suffix at zero provides fresh exploration. Only self-discovered
decisions are reused. Every result is replayed on all training seeds; warnings or endpoint overflow invalidate it. The
selected best rotation and simple baseline are then replayed on held-out seeds without tuning against those results.

Current restrictions:

- Casts, weapon/profession transitions and individual auto-attack chain steps come from engine availability. Concurrent
  instant actions are available during casts at engine event boundaries.
- Waiting choices use pending events, cooldown/resource retries, lane/input readiness, or a one-second idle boundary.
  The session accepts arbitrary positive waits; the current search uses the engine's boundary waits.
- At most 32 actions may be accepted without time advancing. The next choice must wait.
- Full cast reservations must fit before the endpoint; no arbitrary interruption, off-target or delayed-impact variants
  are searched. Default engine skill timing is retained.
- Charge-release professions are outside the currently enabled snapshot family; this first Luminary implementation does
  not search Dragon Trigger release thresholds.
- Heuristic continuations and a finite beam can miss valuable setup sequences. Results are the **best rotation found**,
  not proven global optima. The two default seeds per set give limited statistical coverage; supply more when needed.
- Execution is single-threaded. There is no UI, training pipeline, MCTS, worker pool or new dependency.

## Validation and measurements

With legal suffix refinement and the manifest scalar target, the same 20-second settings at budget 100 produced 35,676.3
training DPS and 35,684.425 mean held-out DPS in 4.37 seconds, with no rejected candidates. At budget 1,000, the search
produced 38,928.1 training DPS and 38,919.975 mean held-out DPS in 42.98 seconds, with 83 restarts and no rejected
candidates. Both runs correctly reported the 41,395 target as unmet. No saved reference rotation was loaded. These are
individual seeded runs, not a general guarantee of search quality.

Focused contracts:

```powershell
npm run build:modules
node --test tests/games/gw2/platform/combat-session.test.js
npm run test:node
npm run typecheck
```

When a sandbox blocks child-process creation, the focused suite can also run with
`node --test --test-isolation=none tests/games/gw2/platform/combat-session.test.js`.

A previous 20-second Power Luminary search before legal suffix refinement, budget 100, beam 4, search seed 1, combat
seeds 11/12 and held-out seeds 1011/1012 found 697,948.5 mean training damage (34,897.425 fixed-window DPS). Held-out
damage was 698,111 for both seeds (34,905.55 DPS). The auto-attack baseline averaged 162,456.5 damage (8,122.825 DPS);
the cold-start preset adaptation dealt 679,805 damage (33,990.25 DPS) on all four seeds. That is approximately 2.67%
higher training damage than the adapted preset in this scenario, not a claim about its original benchmark.

That search took approximately four seconds on the development machine, excluding build/loading/comparison/export, with
100 evaluated candidates, 220 search replay calls and 15 rejected refinement candidates. Hardware and console output
affect runtime. Per-run reports retain measured timings, seeds, scenario/build hashes, Git revision, current source
fingerprint and warnings.

Profiling command:

```powershell
node --cpu-prof --cpu-prof-dir=.scratch --cpu-prof-name=rotation-optimizer.cpuprofile scripts/analysis/optimize-rotation.mjs --duration 20 --budget 100 --output-dir .scratch/optimizer-profile
```

The first profile showed legal-action enumeration, repeated cooldown refreshes and cursor copying as major costs;
checkpoint cloning was under 1% of search time. Reusing a decision's legal list, refreshing cooldowns once per
enumeration, and reading lane readiness without copying the rotation reduced the same search from roughly eight to four
seconds with identical scores. Report phases are overlapping measurements: continuation time includes its engine work,
while preparation/execution/reporting describe explicit replay calls.
