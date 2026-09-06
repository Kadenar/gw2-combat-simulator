# Local rotation AI

Train a small neural model on rotations evaluated by this simulator, then use it to guide a local evolutionary search.
Supply a build and example rotations; the tool generates variations, simulates them, learns which candidates look
promising, and exports the best **actually simulated** rotation.

Everything runs on your computer in Node.js. No hosted model, API key, Python installation, GPU, or additional runtime
dependency is needed. Training data and models stay in your experiment directory.

**Version 1 maximizes player damage during a fixed duration against an immortal target.** It sets target health to zero
in its exported build. It does not optimize a finite-health golem's kill time or its evolving execute phase. The result
is the best rotation found under your settings and search budget, not a proof of global optimality.

## Implementation plan and delivered components

| Step                | Implementation                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| Reuse combat rules  | Existing build adapters prepare stats/config; `simulateGw2` evaluates every scored candidate.          |
| Seed the dataset    | Ingest ordinary exported rotation JSON and re-simulate it for the experiment's fixed build.            |
| Generate experience | Mutate casts, blocks, existing timing variants, and waits; record successful and rejected candidates.  |
| Train locally       | A CPU multilayer perceptron predicts total damage from rotation sequence features.                     |
| Guide search        | Rank a pool of proposals with the model while reserving random exploration.                            |
| Resume work         | Append scored examples, save model weights, and checkpoint the search RNG after completed batches.     |
| Validate and export | Re-run winners through detailed simulation, export ordinary JSON, and compare paired stochastic seeds. |

The current engine schedules a supplied rotation and then resolves its effects. This implementation works with that
boundary. It is **supervised learning plus search**, not PPO, a language model, or a next-action combat policy. Future
reinforcement learning would need an incremental environment containing both scheduler and resolver state. Combat
definitions remain the source of truth; this tool does not duplicate profession mechanics.

## 1. Install the draft branch

From your existing checkout, with unrelated work committed or otherwise safely preserved:

```sh
git fetch origin
git switch --track origin/codex/local-rotation-ai
npm ci
npm run test:rotation-ai
```

If the local branch already exists, use `git switch codex/local-rotation-ai`. Use the repository's supported Node
version (`>=20.19`; a current Node LTS is suitable). Commands work in PowerShell, Command Prompt, Bash, and zsh; quote
paths containing spaces.

The npm entry point compiles the simulator before each command:

```sh
npm run rotation:ai -- --help
```

After building, repeated commands can avoid that overhead with `node scripts/analysis/rotation-ai/cli.mjs ...`. Run
`npm run build:modules` after simulator TypeScript changes when using the direct Node command.

## 2. Run the included example

This uses the repository's Core Engineer hammer build and rotation; no log download or input creation is required.

```sh
npm run rotation:ai -- init --example --run .rotation-ai/engineer-demo --seconds 30
npm run rotation:ai -- collect --run .rotation-ai/engineer-demo --evaluations 1000 --workers 2
npm run rotation:ai -- train --run .rotation-ai/engineer-demo --epochs 60
npm run rotation:ai -- search --run .rotation-ai/engineer-demo --evaluations 3000 --workers 2
npm run rotation:ai -- verify --run .rotation-ai/engineer-demo --seeds 30
npm run rotation:ai -- status --run .rotation-ai/engineer-demo
```

Initialization prints the baseline and retained seed-command count. Search prints valid-candidate rate, measured
throughput, model status, and best improvement after every batch. A strong starting rotation may be difficult to
improve; a successful installation does not imply a positive DPS gain.

If training reports too few examples, run `collect` again. Budgets count **unique attempted candidates**, including
invalid ones. Training requires at least 16 training and four validation examples. Aim for hundreds of valid rotations
before drawing conclusions about model quality.

## 3. Initialize your own build

Configure equipment, traits, skills, initial resources, and combat assumptions in the simulator. Use **Export Build**
and **Export Rotation**, then initialize an experiment:

```sh
npm run rotation:ai -- init --build "C:/GW2-AI/inputs/my-build.json" --rotation "C:/GW2-AI/inputs/my-rotation.json" --run .rotation-ai/my-build --seconds 120
```

Build JSON needs the `profession` field supplied by the simulator export. A GW2 chat code alone lacks equipment and
combat assumptions: import it into the simulator, configure the build, and export it first.

Rotations can be bare arrays or wrappers containing `rotation`. Skill names, numeric IDs, and canonical commands are
accepted through the existing normalizer. This illustrates the format; choose skills compatible with your build:

```json
{
  "rotation": ["Grenade Kit", "Grenade", "Shrapnel Grenade", { "type": "wait", "durationMs": 100 }]
}
```

One run means **one fixed build, precast setup, time window, and engine version**. Start another directory when changing
gear, traits, utilities, initial resources, duration, or combat assumptions. Scores from different experiments cannot be
mixed.

### Precasts and duration

- With a Combat Start marker, everything through that marker becomes immutable, including any legitimate training-area
  reset already in the prefix. Without a marker, Combat Start is inserted at time zero.
- Other demonstrations need the same normalized prefix. Initialize separate runs to investigate different precasts; this
  version does not optimize the prefix itself.
- Mutable combat commands cannot reset cooldowns, move Combat Start, initialize artificial state, force a risky-recast
  outcome, or mark damage off target.
- Initialization/ingestion shorten an overlong demonstration to a complete command prefix that fits, printing the
  retained count. Generated candidates that overrun are rejected rather than silently shortened.
- Entered casts must finish within the window. This version does not optimize a final channel extending beyond the
  cutoff. Delayed damage from completed casts is still observed until the cutoff.

### What the score means

Fitness is the engine's player `totalDamage` from locked Combat Start through `Combat Start + seconds`. Environment
damage is excluded. All candidates have the same window, including idle time. Short candidates receive a final explicit
wait so conditions, fields, summons, and other persistent effects continue through the boundary.

The tool shows `fixedWindowDps = totalDamage / seconds`. The UI's usual DPS starts at the first positive hit and can
differ. `report.json` includes both values. Compare total damage and duration when checking replay, and retain the final
wait. It gives ordinary UI simulation the same observation boundary without a special mode.

Target health is zero, so it does not decrease through execute thresholds. Other build assumptions remain in the
exported build. Permanent boons, optimistic proc assumptions, starting resources, and omitted mechanics define what
“best” means for this experiment; review them before interpreting the result as a playable benchmark improvement.

## 4. Seed with additional training demonstrations

```sh
npm run rotation:ai -- ingest --run .rotation-ai/my-build --rotation "C:/GW2-AI/inputs/attempt-2.json"
npm run rotation:ai -- ingest --run .rotation-ai/my-build --rotation "C:/GW2-AI/inputs/attempt-3.json" --rotation "C:/GW2-AI/inputs/attempt-4.json"
npm run rotation:ai -- ingest --run .rotation-ai/my-build --rotations "C:/GW2-AI/demonstrations"
```

Directory ingestion reads JSON files directly inside that directory, without recursion. Keep it limited to rotations for
the same build. Duplicate normalized rotations are skipped. Every accepted demonstration is scored afresh: benchmark
metadata, imported DPS labels, and manually supplied scores are not training rewards. Rejected files produce clear
errors and a nonzero command exit; successful files remain ingested.

Useful examples include your current benchmark, alternative openers after the same precast setup, different kit or
attunement orders, and simpler legal rotations. Stronger and weaker valid examples both teach differences. Repeated
copies of one rotation add no training information.

For EVTC/ZEVTC or dps.report data, use the existing simulator rotation importer, inspect reconstruction and warnings,
then export the rotation JSON. Raw logs are not inputs to this tool. A good log does not make reconstructed missing
casts or timing errors correct.

### Add skills absent from demonstrations

Search uses skills from valid demonstrations, explicit additional actions, and small waits. To inspect available catalog
identities:

```sh
npm run rotation:ai -- catalog --run .rotation-ai/my-build --out .rotation-ai/my-build-catalog.json
```

Copy desired names or IDs into a separate array or `rotation` wrapper, then ingest it:

```sh
npm run rotation:ai -- ingest --run .rotation-ai/my-build --actions "C:/GW2-AI/inputs/allowed-actions.json"
```

The catalog includes skills your build cannot use. Include transition actions needed to reach your choices, such as kit
entry/exit or attunement changes; legality remains engine-owned. Inserted casts use default timing and any supplied
charge choice. Arbitrary overlaps and interrupts are not invented. Existing demonstration timing variants can be moved
or adjusted; add another demonstration to explore a new deliberate overlap/interrupt pattern.

## 5. Collect, train, and search

```sh
npm run rotation:ai -- collect --run .rotation-ai/my-build --evaluations 2000 --workers 2
npm run rotation:ai -- train --run .rotation-ai/my-build --epochs 60
npm run rotation:ai -- search --run .rotation-ai/my-build --evaluations 10000 --workers 2 --retrain-every 200 --exploration 0.3
```

`collect` runs unguided evolutionary search and retains the best measured result. Mutations insert/delete/replace casts,
swap actions, move or cross over short blocks, and adjust existing timing. Parents mostly come from the best 24
candidates, with some from the wider valid archive for diversity.

`train` fits a 256-input, 24-hidden-unit tanh neural network with one damage output. Features describe skill counts,
nearby pairs/triples, sequence quarters, waits, and supplied timing variants. This is a **proposal-ranking surrogate**,
not a substitute for combat simulation or a complete combat-state representation.

Training uses shuffled stochastic gradient descent, scaled targets, clipped training error, and early stopping. A stable
hash split sends roughly 80% of unique rotations to training and 20% to validation. The best validation checkpoint is
saved. Re-running training refits from the whole current dataset; it does not continue an old optimizer's gradients or
reuse normalization from a different dataset size.

Validation RMSE is compared with always predicting the training mean. Guidance activates only when the neural model
reduces that error by at least 2%. Otherwise its weights are saved for inspection but search keeps using unguided
proposals until a later model passes. Related rotation variants can make validation easier than discovering new peaks;
low error alone does not prove improved search efficiency.

`search` trains automatically when enough data exists and periodically refits. When guidance is active, it generates up
to four times the requested candidate batch, reserves random exploration, and fills remaining evaluations with the
highest predicted scores. **Only simulator scores select winners.** An optimistic model prediction alone never becomes a
reported improvement.

### Resume and backup

Run collection/search again to continue; `--evaluations` is an **additional** budget. The RNG resumes from the saved
checkpoint. Worker completion order does not affect proposal ordering; changing worker count is supported. Changing
data, mode, batch size, or guidance settings changes the trajectory. Set `--seed` on the first collection/search command
and omit it afterward to resume.

Press Ctrl+C once to finish the current batch, checkpoint, and export; a second Ctrl+C exits immediately. Completed
dataset batches survive. If forcibly killed between dataset append and checkpoint write, the checkpoint can lag the
dataset. Duplicate detection preserves evaluated examples, although the resumed trajectory may differ from an
uninterrupted run.

Back up the **whole run directory and compatible repository revision**. `.rotation-ai/` is ignored by Git, ESLint, and
Prettier. These commands do not upload your examples, weights, or results. Do not edit experiment IDs, scores, or
weights by hand. Use independent directories for different builds/settings.

## 6. Verify and load the winner

```sh
npm run rotation:ai -- verify --run .rotation-ai/my-build --seeds 30 --seed 1000001
```

Verification checks detailed deterministic replay, then evaluates the baseline and deterministic winner using the same
stochastic seed list. It reports mean improvement and its paired standard error. Every trial retains the same combat
window. Warnings, overruns, or inconsistent timing fail verification instead of being silently omitted.

These seeds do not select the winner. After inspecting them and adapting your search, treat them as validation data; use
another seed range for a final check. A gain comparable to its standard error needs more evidence. A deterministic gain
can fail to improve stochastic average damage.

In the browser:

1. Open the correct profession in the same simulator revision.
2. Import `best.build.json` with Import Build, including its immortal-target setup.
3. Import `best.rotation.json` with Import Rotation.
4. Simulate and compare total damage, duration, warnings, and breakdown with `report.json`.
5. Review whether execution demands and assumptions match your goal.

Keep the final wait when checking the fixed-window result. Changing to a finite-health target changes the objective;
re-evaluate that separately. The tool does not automate game inputs.

## Files

| File in the run directory               | Purpose                                                                                  |
| --------------------------------------- | ---------------------------------------------------------------------------------------- |
| `scenario.json`                         | Frozen build, resolved config, prefix, objective, engine fingerprint, and experiment ID. |
| `baseline.json`                         | Original fitted demonstration and deterministic score.                                   |
| `actions.json`                          | Explicit additional proposal actions.                                                    |
| `dataset.jsonl`                         | Evaluated candidates and rejection reasons; only valid rows train the damage predictor.  |
| `model.json`                            | Weights, normalization, feature schema, dataset fingerprint, and validation metrics.     |
| `checkpoint.json`                       | Search seed, RNG state, attempted count, and winner ID at the last checkpoint.           |
| `winner.json`                           | Best unpadded combat sequence and measured score.                                        |
| `best.build.json`, `best.rotation.json` | Ordinary UI imports; rotation includes precasts and the final wait.                      |
| `report.json`                           | Baseline/best metrics, both DPS definitions, gain, and detailed replay status.           |
| `verification.json`                     | Paired stochastic samples, winner ID, mean gain, and standard error.                     |
| `run.lock`                              | Exclusive lock while a command uses the experiment.                                      |

Verification records its winner ID. Run verification again after finding another winner. Checkpoints/model files use
same-directory temporary writes and rename. Only the main process appends dataset rows; workers never write data.

## Performance and troubleshooting

Begin with two workers and a 20–30-second window to learn the workflow, then use the duration appropriate for your
objective. Size budgets from observed candidates/second, which includes invalid attempts and scoring overhead. For
example, 20,000 candidates at 40/s is roughly 8.3 minutes before training/verification overhead: this is arithmetic, not
a performance claim for your PC. More workers use more CPU/memory and may not scale linearly. A GPU does not accelerate
this implementation.

| Symptom                          | Action                                                                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Missing modules/stale build      | Run `npm ci` and `npm run build:modules`; use the npm entry point afterward.                                           |
| Run already exists               | Resume it or choose another directory. Initialization never overwrites an experiment.                                  |
| Simulator code changed           | Initialize a new run and ingest your source/exported rotations again to regenerate scores.                             |
| Too few training examples        | Collect more; inspect the valid count with `status`. Rejected attempts are not damage-training examples.               |
| Most proposals invalid           | Inspect common rejection reasons; supply legal demonstrations and required transition skills.                          |
| Most proposals exceed the window | Add demonstrations with different cast counts/timings. The final cast must finish before the cutoff.                   |
| Model inactive                   | Collect more diverse valid examples and retrain. The validation check is keeping a weak predictor out of selection.    |
| No improvement                   | Add legal action choices or demonstrations, review the objective, and compare unguided search. Gain is not guaranteed. |
| Run locked                       | Wait for its command. After a crash, ensure no process is using the run, then remove only `run.lock`.                  |
| Incomplete dataset line          | Back up the file, inspect the stated line, and remove only the incomplete record, preserving prior valid rows.         |
| Worker timeout                   | Default is 30 seconds per candidate; reduce commands or increase `--timeout`. Completed batches remain saved.          |
| Stochastic verification fails    | Inspect the reported seed/reason and profession mechanics before claiming an average improvement.                      |
| Different UI DPS                 | Preserve exported settings/wait and compare total damage; UI DPS uses a first-hit denominator.                         |

Limits are 2,000 total commands and windows up to 600 seconds. Datasets are loaded into memory; this version targets
personal experiments with thousands to tens of thousands of candidates. Streaming storage/training can follow if
measured workloads justify it.

## Does learning actually help?

After collecting/training, copy the entire idle run directory into two experiments. Use the same additional budget,
batch size, and worker count with `search` in one and `search --unguided` in the other. Both begin with the same archive
and RNG checkpoint, then diverge when guidance affects selection. Compare verified damage, evaluation count, wall time,
and stochastic outcomes. Repeat with independent initial runs/search seeds before concluding guidance is better.

Sequence features do not fully describe cooldowns, resources, effect expirations, or long-range dependencies. The model
can miss useful patterns, and search can get stuck. Simulator modeling errors may look like opportunities to an
optimizer. Inspect unusually large gains in the detailed event/timing view.

## Maintainer notes and further research

Code lives in `scripts/analysis/rotation-ai/`: `engine.mjs` adapts simulation, `model.mjs` owns neural
features/training, `mutations.mjs` proposes candidates, `pool.mjs`/`worker.mjs` run evaluations, and
`storage.mjs`/`cli.mjs` manage experiments.

`npm run test:rotation-ai` checks gradients against finite differences, held-out synthetic learning, real-preset
scoring, detailed replay, worker failures, ingestion/deduplication, training, resume, compatibility/corruption
rejection, stochastic validation, and ordinary exports. Run lint and format checks on changed files.

Fingerprints cover compiled modules and the scoring adapter. Bump the model feature schema when feature meanings change,
and experiment schemas when serialized contracts change incompatibly. Never mix scores from engine versions.

Future options include finite-health kill-time optimization, richer learned sequence representations, measured prefix
caching, and a causal `reset/observe/legalActions/step` environment for RL. An incremental environment must preserve
ongoing casts, scheduler tasks, resolver events, timed effects, resources, and RNG state and demonstrate parity with
ordinary simulation. The UI's projected end state alone is not sufficient.
