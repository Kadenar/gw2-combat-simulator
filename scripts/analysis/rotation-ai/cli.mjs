#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readdir, access } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ROOT,
  SCHEMA,
  digest,
  readJson,
  writeJson,
  engineFingerprint,
  loadRun,
  lockRun,
  readRecords,
  appendRecords,
  random
} from './storage.mjs';
import { makeScenario, createEvaluator, commandsFrom, splitRotation, validateBody } from './engine.mjs';
import { trainModel, validateModel } from './model.mjs';
import { actionVocabulary, propose } from './mutations.mjs';
import { SimulationPool } from './pool.mjs';
import { initializeBank, contributeRun, trainingCorpus, compatibleContext } from './profession-models.mjs';

const HELP = `Local rotation AI — CPU neural surrogate + simulator-verified evolutionary search

Run from the repository root. npm run rotation:ai builds the simulation modules first.

  npm run rotation:ai -- init --example --run .rotation-ai/demo --seconds 30
  npm run rotation:ai -- init --build build.json --rotation rotation.json --run .rotation-ai/my-build --seconds 120
  npm run rotation:ai -- ingest --run DIR --rotation another.json
  npm run rotation:ai -- ingest --run DIR --rotations DIRECTORY
  npm run rotation:ai -- ingest --run DIR --actions allowed-actions.json
  npm run rotation:ai -- collect --run DIR --evaluations 1000 --workers 2
  npm run rotation:ai -- train --run DIR --training-run OTHER_BUILD_DIR --epochs 60
  npm run rotation:ai -- search --run DIR --evaluations 5000 --workers 2
  npm run rotation:ai -- verify --run DIR --seeds 30 --seed 1000001
  npm run rotation:ai -- status --run DIR
  npm run rotation:ai -- catalog --run DIR --out skills.json

collect/search resume automatically; --evaluations is an ADDITIONAL unique-candidate budget.
Ctrl+C saves the completed batch and exits. A second Ctrl+C exits immediately.
Search retrains every --retrain-every 200 new records and reserves --exploration 0.3 for random proposals.
Use search --unguided for an ablation with identical search operators and no model guidance.
Other options: --seed 42 (new search RNG), --batch 16, --timeout 30 (seconds per worker job).
init defaults to 120 seconds and --example uses the repository's Core Engineer hammer preset.
init/ingest trim demonstration suffixes that exceed the window; precasts remain locked.

Each profession shares .rotation-ai/models/PROFESSION/model.json. Override with --models ROOT.
train --training-run DIR can be repeated to add existing runs. New trait selections reuse the same model.
Outputs in DIR: dataset.jsonl, checkpoint.json, best.rotation.json,
best.build.json, report.json, verification.json. Import the build then the rotation in the UI.
Read docs/LOCAL-ROTATION-AI.md for the full workflow, constraints, and troubleshooting.
`;

const ALLOWED = {
  init: ['run', 'build', 'rotation', 'seconds', 'example'],
  ingest: ['run', 'rotation', 'rotations', 'actions'],
  collect: ['run', 'evaluations', 'workers', 'seed', 'batch', 'timeout'],
  train: ['run', 'epochs', 'seed', 'training-run'],
  search: ['run', 'evaluations', 'workers', 'seed', 'batch', 'timeout', 'retrain-every', 'exploration', 'unguided'],
  verify: ['run', 'seeds', 'seed', 'workers', 'timeout'],
  status: ['run'],
  catalog: ['run', 'out']
};

function numberOption(values, name, fallback, min, max, integer = true) {
  const value = values[name] == null ? fallback : Number(values[name]);
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error(`--${name} must be ${integer ? 'an integer' : 'a number'} between ${min} and ${max}.`);
  }

  return value;
}

const optionalJson = async (file) => {
  try {
    return await readJson(file);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
};

const top = (records) =>
  records.filter((record) => record.valid).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))[0];
const format = (value) => Math.round(value).toLocaleString('en-US');

async function exportWinner(directory, scenario, winner, baseline, evaluator) {
  const checked = evaluator.evaluate(winner.rotation, { detailed: true });
  if (!checked.valid || Math.abs(checked.score - winner.score) > Math.max(0.00001, winner.score * 1e-9)) {
    throw new Error(
      `Detailed verification failed: ${checked.reason || 'score disagrees with compact simulation'}. Previous export remains available.`
    );
  }

  const metadata = {
    rotationAi: {
      scenario: scenario.id,
      seconds: scenario.seconds,
      score: checked.score,
      objective: scenario.objective
    }
  };
  const build = { ...scenario.build };
  delete build.rotation;
  await writeJson(path.join(directory, 'best.build.json'), build);
  await writeJson(path.join(directory, 'best.rotation.json'), { rotation: checked.exportedRotation, metadata });
  await writeJson(path.join(directory, 'winner.json'), winner);
  await writeJson(path.join(directory, 'report.json'), {
    schema: SCHEMA,
    scenario: scenario.id,
    objective: scenario.objective,
    description: 'Best simulated rotation found; no global-optimality guarantee.',
    seconds: scenario.seconds,
    targetHealth: 0,
    baseline: baseline.metrics,
    best: checked.metrics,
    damageGain: checked.score - baseline.score,
    percentGain: (checked.score / baseline.score - 1) * 100,
    detailedReplayVerified: true
  });
}

async function initialize(directory, values) {
  if (await optionalJson(path.join(directory, 'scenario.json')))
    throw new Error('Run already exists. Choose a new --run directory.');
  if (values.example && (values.build || values.rotation))
    throw new Error('Use --example or your own --build/--rotation files.');
  if (!values.example && (!values.build || values.rotation?.length !== 1))
    throw new Error('init requires --build and exactly one --rotation, or --example.');
  const buildFile = values.example
    ? path.join(ROOT, 'data/gw2/builds/engineer/b-power-core-hammer.json')
    : values.build;
  const rotationFile = values.example
    ? path.join(ROOT, 'data/gw2/rotations/engineer/r-power-core-hammer-evtc.json')
    : values.rotation[0];
  const seconds = numberOption(values, 'seconds', 120, 1, 600, false);
  const [build, seed, engine] = await Promise.all([readJson(buildFile), readJson(rotationFile), engineFingerprint()]);
  const { scenario, baseline, originalCommands, evaluator } = await makeScenario(build, seed, seconds, engine);
  await writeJson(path.join(directory, 'scenario.json'), scenario);
  await writeJson(path.join(directory, 'baseline.json'), baseline);
  await writeJson(path.join(directory, 'actions.json'), []);
  await appendRecords(directory, scenario, [{ ...baseline, source: 'initial-seed' }]);
  await exportWinner(directory, scenario, baseline, baseline, evaluator);
  console.log(
    `Initialized ${scenario.profession}: ${seconds}s, immortal target, ${scenario.prefix.length} locked precast commands.`
  );
  console.log(
    `Seed retained ${baseline.rotation.length}/${originalCommands} combat commands. Baseline: ${format(baseline.metrics.fixedWindowDps)} damage/s over the fixed window.`
  );
  console.log(`Run: ${directory}\nNext: collect, train, search, then verify. See docs/LOCAL-ROTATION-AI.md.`);
}

async function ingest(directory, scenario, values) {
  const evaluator = await createEvaluator(scenario);
  const records = await readRecords(directory, scenario);
  const seen = new Set(records.map((record) => record.id));
  const files = [...(values.rotation || [])];
  if (values.rotations) {
    const entries = await readdir(values.rotations, { withFileTypes: true });
    files.push(
      ...entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map((entry) => path.join(values.rotations, entry.name))
        .sort()
    );
  }

  if (!files.length && !values.actions) throw new Error('Supply --rotation, --rotations, or --actions.');
  let failures = 0;
  for (const file of files) {
    try {
      const payload = await readJson(file);
      const { prefix, rotation } = splitRotation(commandsFrom(payload, evaluator.catalog));
      if (digest(prefix) !== digest(scenario.prefix))
        throw new Error('Precast prefix differs from this run. Use the same prefix or initialize a separate run.');
      const fitted = evaluator.fit(rotation);
      const record = evaluator.evaluate(fitted);
      if (!record.valid) throw new Error(record.reason);
      if (seen.has(record.id)) {
        console.log(`Duplicate: ${file}`);
        continue;
      }

      await appendRecords(directory, scenario, [{ ...record, source: path.basename(file) }]);
      records.push(record);
      seen.add(record.id);
      console.log(
        `Ingested ${file}: ${fitted.length}/${rotation.length} commands; ${format(record.metrics.fixedWindowDps)} damage/s.`
      );
    } catch (error) {
      failures++;
      console.error(`Rejected ${file}: ${error.message}`);
    }
  }

  if (values.actions) {
    const additional = commandsFrom(await readJson(values.actions), evaluator.catalog);
    validateBody(additional);
    const existing = await readJson(path.join(directory, 'actions.json'));
    const merged = [...new Map([...existing, ...additional].map((action) => [digest(action), action])).values()];
    await writeJson(path.join(directory, 'actions.json'), merged);
    console.log(
      `Added actions. ${merged.length} explicit actions available alongside demonstrated skills; the simulator still checks legality.`
    );
  }

  const baseline = await readJson(path.join(directory, 'baseline.json'));
  await exportWinner(directory, scenario, top(records), baseline, evaluator);
  if (failures) process.exitCode = 1;
}

async function saveModel(directory, scenario, records, values) {
  const model = trainModel(records, scenario, {
    epochs: numberOption(values, 'epochs', 60, 1, 2000),
    seed: numberOption(values, 'seed', 42, 0, 4294967295)
  });
  await writeJson(path.join(directory, 'model.json'), model);
  console.log(
    `Model: ${model.metrics.trainingExamples} training / ${model.metrics.validationExamples} validation examples; validation RMSE ${format(model.metrics.validationRmse)} damage/s, constant-mean RMSE ${format(model.metrics.meanPredictorRmse)}.`
  );
  console.log(
    model.metrics.useful
      ? 'Validation supports using this model to rank search proposals.'
      : 'This model has not beaten the mean predictor by 2%. Search keeps exploring without model guidance until a retrain passes that check.'
  );
  console.log(
    `Shared ${scenario.profession} model: ${model.metrics.builds} builds / ${model.metrics.scenarios} scenarios; validation: ${model.metrics.validationMode}. Saved ${path.join(directory, 'model.json')}`
  );
  return model;
}

async function search(directory, scenario, values, guided, bank) {
  const budget = numberOption(values, 'evaluations', 1000, 1, 10000000);
  const workers = numberOption(values, 'workers', Math.min(2, availableParallelism()), 1, 32);
  const batchSize = numberOption(values, 'batch', 16, 1, 256);
  const timeoutMs = numberOption(values, 'timeout', 30, 1, 3600) * 1000;
  const exploration = numberOption(values, 'exploration', 0.3, 0.1, 1, false);
  const retrainEvery = numberOption(values, 'retrain-every', 200, 20, 1000000);
  const seed = numberOption(values, 'seed', 42, 0, 4294967295);
  const records = await readRecords(directory, scenario);
  const baseline = await readJson(path.join(directory, 'baseline.json'));
  const evaluator = await createEvaluator(scenario);
  const checkpoint = await optionalJson(path.join(directory, 'checkpoint.json'));
  if (
    checkpoint &&
    (checkpoint.scenario !== scenario.id || checkpoint.schema !== SCHEMA || !Number.isInteger(checkpoint.rngState))
  )
    throw new Error('Checkpoint is incompatible or corrupt.');
  if (checkpoint && values.seed != null && seed !== checkpoint.seed)
    throw new Error('This run already has a search seed. Omit --seed to resume, or initialize a new run.');
  const rng = random(checkpoint?.rngState ?? seed);
  const seen = new Set(records.map((record) => record.id));
  const actions = actionVocabulary(
    records.filter((record) => record.valid),
    await readJson(path.join(directory, 'actions.json'))
  );
  let model = guided ? await optionalJson(path.join(bank, 'model.json')) : null;
  if (model) validateModel(model, scenario);
  let lastTraining = records.length;
  let completed = 0;
  let stopped = false;
  let signals = 0;
  const onSignal = () => {
    if (++signals > 1) process.exit(130);
    stopped = true;
    console.log('Stopping after the current batch; writing checkpoint and verified exports.');
  };

  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
  const pool = new SimulationPool(scenario, workers, timeoutMs);
  let best = top(records);
  const started = performance.now();
  const tryTrain = async () => {
    try {
      await contributeRun(bank, directory, scenario, records);
      model = await saveModel(bank, scenario, await trainingCorpus(bank, scenario), {});
    } catch (error) {
      if (!error.message.startsWith('Need at least')) throw error;
    }

    lastTraining = records.length;
  };

  const saveCheckpoint = () =>
    writeJson(path.join(directory, 'checkpoint.json'), {
      schema: SCHEMA,
      scenario: scenario.id,
      seed: checkpoint?.seed ?? seed,
      rngState: rng.state(),
      attempted: records.length - 1,
      winner: best.id
    });
  try {
    if (guided && !model) await tryTrain();
    console.log(
      `Starting ${guided ? 'AI-assisted' : 'unguided'} search; ${workers} workers, ${budget} additional evaluations. Existing best: ${format(best.metrics.fixedWindowDps)} damage/s.`
    );
    while (completed < budget && !stopped) {
      const candidates = propose(
        records,
        actions,
        seen,
        rng,
        Math.min(batchSize, budget - completed),
        model,
        exploration,
        scenario
      );
      if (!candidates.length) {
        console.log('No new candidates found. Add demonstrations or actions to expand the search.');
        break;
      }

      // Commit a completed batch before generating the next one; worker completion order never changes selection.
      const results = await Promise.all(candidates.map((rotation) => pool.evaluate(rotation)));
      await appendRecords(directory, scenario, results);
      records.push(...results);
      results.forEach((record) => seen.add(record.id));
      completed += results.length;
      const next = top(records);
      if (next.id !== best.id) {
        await exportWinner(directory, scenario, next, baseline, evaluator);
        best = next;
      }

      await saveCheckpoint();
      const elapsed = (performance.now() - started) / 1000;
      const valid = results.filter((record) => record.valid).length;
      console.log(
        `${completed}/${budget} candidates; ${valid}/${results.length} valid this batch; best ${format(best.metrics.fixedWindowDps)} damage/s (${((best.score / baseline.score - 1) * 100).toFixed(3)}%); ${(completed / Math.max(0.001, elapsed)).toFixed(1)} candidates/s; model ${model?.metrics.useful ? 'active' : 'inactive'}.`
      );
      if (guided && records.length - lastTraining >= retrainEvery && !stopped) await tryTrain();
    }

    await saveCheckpoint();
    await exportWinner(directory, scenario, best, baseline, evaluator);
    console.log(`Saved ${directory}/best.rotation.json and report.json. Run verify before using a result.`);
  } finally {
    await pool.close();
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
  }
}

export function pairedSummary(baseline, winner) {
  if (baseline.length !== winner.length || baseline.length < 2)
    throw new Error('Paired evaluation needs at least two equal-length samples.');
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const differences = winner.map((value, index) => value - baseline[index]);
  const gain = mean(differences);
  const sd = Math.sqrt(differences.reduce((sum, value) => sum + (value - gain) ** 2, 0) / (differences.length - 1));
  return {
    samples: baseline.length,
    baselineMean: mean(baseline),
    winnerMean: mean(winner),
    meanGain: gain,
    standardErrorOfGain: sd / Math.sqrt(differences.length)
  };
}

async function verify(directory, scenario, values) {
  const count = numberOption(values, 'seeds', 30, 2, 10000);
  const seed = numberOption(values, 'seed', 1000001, 0, 4294967295 - count);
  const workers = numberOption(values, 'workers', Math.min(2, availableParallelism()), 1, 32);
  const timeoutMs = numberOption(values, 'timeout', 30, 1, 3600) * 1000;
  const baseline = await readJson(path.join(directory, 'baseline.json'));
  const winner = top(await readRecords(directory, scenario));
  const evaluator = await createEvaluator(scenario);
  await exportWinner(directory, scenario, winner, baseline, evaluator);
  const checkedBaseline = evaluator.evaluate(baseline.rotation, { detailed: true });
  if (
    !checkedBaseline.valid ||
    Math.abs(checkedBaseline.score - baseline.score) > Math.max(0.00001, baseline.score * 1e-9)
  )
    throw new Error('Baseline detailed replay disagrees with the stored score.');
  const pool = new SimulationPool(scenario, workers, timeoutMs);
  const samples = [];
  try {
    for (let index = 0; index < count; index++) {
      const options = { mode: 'stochastic', seed: seed + index, detailed: true };
      const [base, best] = await Promise.all([
        pool.evaluate(baseline.rotation, options),
        pool.evaluate(winner.rotation, options)
      ]);
      if (!base.valid || !best.valid)
        throw new Error(
          `Stochastic seed ${seed + index} failed: ${base.reason || best.reason}. No distribution claim was saved.`
        );
      samples.push({ seed: seed + index, baseline: base.score, winner: best.score });
      if ((index + 1) % 5 === 0 || index + 1 === count)
        console.log(`Verified ${index + 1}/${count} paired stochastic seeds.`);
    }
  } finally {
    await pool.close();
  }

  const summary = pairedSummary(
    samples.map((sample) => sample.baseline),
    samples.map((sample) => sample.winner)
  );
  await writeJson(path.join(directory, 'verification.json'), {
    schema: SCHEMA,
    scenario: scenario.id,
    winner: winner.id,
    seconds: scenario.seconds,
    note: 'These seeds evaluate the deterministic winner; they never select it. Repeated inspection/adaptation makes them validation data, not an untouched final test.',
    summary,
    samples
  });
  console.log(
    `Mean fixed-window gain: ${format(summary.meanGain / scenario.seconds)} damage/s; standard error ${format(summary.standardErrorOfGain / scenario.seconds)} across ${count} paired seeds.`
  );
}

async function status(directory, scenario, bank) {
  const records = await readRecords(directory, scenario);
  const valid = records.filter((record) => record.valid);
  const report = await readJson(path.join(directory, 'report.json'));
  const reasons = new Map();
  records
    .filter((record) => !record.valid)
    .forEach((record) => reasons.set(record.reason, (reasons.get(record.reason) || 0) + 1));
  console.log(
    JSON.stringify(
      {
        profession: scenario.profession,
        seconds: scenario.seconds,
        uniqueCandidates: records.length,
        validCandidates: valid.length,
        bestFixedWindowDps: top(records)?.metrics.fixedWindowDps,
        exportedGainPercent: report.percentGain,
        commonRejections: [...reasons].sort((a, b) => b[1] - a[1]).slice(0, 5),
        model: (await optionalJson(path.join(bank, 'model.json')))?.metrics || null
      },
      null,
      2
    )
  );
}

export async function main(args = process.argv.slice(2)) {
  const definitions = Object.fromEntries(
    [
      'run',
      'build',
      'rotations',
      'actions',
      'seconds',
      'evaluations',
      'workers',
      'seed',
      'batch',
      'timeout',
      'epochs',
      'retrain-every',
      'exploration',
      'seeds',
      'out',
      'models'
    ].map((key) => [key, { type: 'string' }])
  );
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      ...definitions,
      rotation: { type: 'string', multiple: true },
      'training-run': { type: 'string', multiple: true },
      example: { type: 'boolean' },
      unguided: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' }
    }
  });
  if (values.help || !positionals.length) {
    console.log(HELP);
    return;
  }

  const [command] = positionals;
  if (!ALLOWED[command] || positionals.length !== 1)
    throw new Error('Choose one command: init, ingest, collect, train, search, verify, status, catalog. Use --help.');
  for (const key of Object.keys(values))
    if (key !== 'models' && !ALLOWED[command].includes(key))
      throw new Error(`--${key} is not supported by ${command}.`);
  if (!values.run) throw new Error('Specify --run DIR so this experiment has its own data and checkpoints.');
  await access(path.join(ROOT, 'dist/js/games/gw2/platform/simulation/simulate.js')).catch(() => {
    throw new Error('Build the simulator first: npm run build:modules');
  });
  const directory = path.resolve(values.run);
  const release = await lockRun(directory, command);
  let releaseBank;
  try {
    if (command === 'init') await initialize(directory, values);
    const scenario = await loadRun(directory);
    const selection = await optionalJson(path.join(directory, 'model-source.json'));
    const modelsRoot = values.models
      ? path.resolve(values.models)
      : selection
        ? path.resolve(directory, selection.root)
        : path.join(ROOT, '.rotation-ai/models');
    const bank = path.join(modelsRoot, scenario.profession);
    // A consistent run-then-bank lock order keeps shared dataset/model writes safe.
    releaseBank = await lockRun(bank, `profession:${command}`);
    await initializeBank(bank, scenario);
    await writeJson(path.join(directory, 'model-source.json'), { root: path.relative(directory, modelsRoot) });
    await contributeRun(bank, directory, scenario);
    if (command === 'init') {
      console.log(`Shared profession model: ${path.join(bank, 'model.json')}`);
      return;
    }

    if (command === 'ingest') {
      await ingest(directory, scenario, values);
      await contributeRun(bank, directory, scenario);
      return;
    }

    if (command === 'collect' || command === 'search') {
      await search(directory, scenario, values, command === 'search' && !values.unguided, bank);
      await contributeRun(bank, directory, scenario);
      return;
    }

    if (command === 'train') {
      // Validate every additional run before admitting any of its examples.
      const additional = await Promise.all(
        (values['training-run'] || []).map(async (run) => ({
          run: path.resolve(run),
          context: await loadRun(path.resolve(run))
        }))
      );
      additional.forEach(({ context }) => compatibleContext(context, scenario));
      for (const { run, context } of additional) {
        const unlock = path.resolve(run) === directory ? null : await lockRun(run, 'contribute-to-profession');
        try {
          await contributeRun(bank, run, context);
          await writeJson(path.join(run, 'model-source.json'), { root: path.relative(run, modelsRoot) });
        } finally {
          if (unlock) await unlock();
        }
      }

      return await saveModel(bank, scenario, await trainingCorpus(bank, scenario), values);
    }

    if (command === 'verify') return await verify(directory, scenario, values);
    if (command === 'status') return await status(directory, scenario, bank);
    if (command === 'catalog') {
      if (!values.out) throw new Error('catalog requires --out FILE.');
      const evaluator = await createEvaluator(scenario);
      await writeJson(
        path.resolve(values.out),
        [...evaluator.catalog.skillsById.values()].map(({ id, name, type }) => ({ skillId: id, name, category: type }))
      );
      console.log(
        'Saved profession catalog. Copy only desired entries into an actions array; this list also includes skills unavailable to your build.'
      );
    }
  } finally {
    if (releaseBank) await releaseBank();
    await release();
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await main().catch((error) => {
    console.error(`Rotation AI: ${error.message}`);
    process.exitCode = 1;
  });
}
