import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, writeFile, access, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { readJson, readRecords, loadRun, lockRun, writeJson } from '../../scripts/analysis/rotation-ai/storage.mjs';
import { createEvaluator, prepareBuild } from '../../scripts/analysis/rotation-ai/engine.mjs';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { pairedSummary } from '../../scripts/analysis/rotation-ai/cli.mjs';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../../', import.meta.url));

test(
  'CLI seeds, collects, trains, resumes, verifies, and exports an ordinary importable rotation',
  { timeout: 120000 },
  async () => {
    const temporary = await mkdtemp(path.join(tmpdir(), 'rotation-ai-'));
    const run = path.join(temporary, 'run with spaces');
    const invoke = (...args) =>
      exec(
        process.execPath,
        ['scripts/analysis/rotation-ai/cli.mjs', ...args, '--run', run, '--models', path.join(temporary, 'models')],
        {
          cwd: root,
          maxBuffer: 2 * 1024 * 1024
        }
      );
    try {
      const seed = path.join(temporary, 'seed.json');
      await writeJson(seed, { rotation: ['Grenade Kit', ...Array(7).fill('Grenade')] });
      await invoke(
        'init',
        '--build',
        'data/gw2/builds/engineer/b-power-core-hammer.json',
        '--rotation',
        seed,
        '--seconds',
        '12'
      );
      await assert.rejects(access(path.join(run, 'run.lock')), { code: 'ENOENT' });
      const scenario = await loadRun(run);
      const baseline = await readJson(path.join(run, 'baseline.json'));
      await invoke('ingest', '--rotation', seed);
      assert.equal((await readRecords(run, scenario)).length, 1, 'duplicate demonstrations are not duplicated');
      await invoke('collect', '--evaluations', '160', '--workers', '2', '--seed', '42');
      const collected = await readRecords(run, scenario);
      assert.equal(collected.length, 161);
      assert.ok(collected.filter((record) => record.valid).length >= 30);
      await invoke('train', '--epochs', '30');
      const model = await readJson(path.join(temporary, 'models', 'engineer', 'model.json'));
      assert.ok(model.metrics.validationExamples >= 4);
      const checkpoint = await readJson(path.join(run, 'checkpoint.json'));
      await invoke('search', '--evaluations', '24', '--workers', '1');
      assert.equal((await readRecords(run, scenario)).length, 185);
      assert.notEqual((await readJson(path.join(run, 'checkpoint.json'))).rngState, checkpoint.rngState);
      await assert.rejects(invoke('search', '--evaluations', '1', '--seed', '999'), /already has a search seed/);
      if (process.platform !== 'win32') {
        // Windows process.kill does not emulate a console Ctrl+C event; verify POSIX graceful cancellation here.
        const interrupted = await new Promise((resolve, reject) => {
          const child = spawn(
            process.execPath,
            [
              'scripts/analysis/rotation-ai/cli.mjs',
              'collect',
              '--run',
              run,
              '--evaluations',
              '100000',
              '--workers',
              '1',
              '--batch',
              '4'
            ],
            { cwd: root }
          );
          let output = '';
          let signaled = false;
          const timer = setTimeout(() => {
            child.kill('SIGKILL');
            reject(new Error('Cancellation test timed out.'));
          }, 15000);
          child.stdout.on('data', (chunk) => {
            output += chunk;
            if (!signaled && output.includes('/100000 candidates;')) {
              signaled = true;
              child.kill('SIGINT');
            }
          });
          child.stderr.on('data', (chunk) => {
            output += chunk;
          });
          child.on('error', (error) => {
            clearTimeout(timer);
            reject(error);
          });
          child.on('exit', (code) => {
            clearTimeout(timer);
            resolve({ code, output });
          });
        });
        assert.equal(interrupted.code, 0, interrupted.output);
        assert.match(interrupted.output, /Stopping after the current batch/);
        await assert.rejects(access(path.join(run, 'run.lock')), { code: 'ENOENT' });
        const stoppedRecords = await readRecords(run, scenario);
        assert.ok(stoppedRecords.length > 185 && stoppedRecords.length < 300);
        assert.equal((await readJson(path.join(run, 'checkpoint.json'))).attempted, stoppedRecords.length - 1);
      }

      await invoke('verify', '--seeds', '3', '--workers', '2');
      const verification = await readJson(path.join(run, 'verification.json'));
      assert.equal(verification.samples.length, 3);
      const exported = await readJson(path.join(run, 'best.rotation.json'));
      const evaluator = await createEvaluator(scenario);
      const replay = evaluator.run(exported.rotation, { detailed: true });
      assert.ok(replay.totalDamage >= baseline.score);
      assert.equal(replay.warnings.length, 0);
      assert.ok(Math.abs(replay.duration - scenario.endTime) < 0.00001);
      const outputBuild = await readJson(path.join(run, 'best.build.json'));
      assert.equal(outputBuild.targetHealth, 0);
      assert.equal(outputBuild.rotation, undefined);
      const imported = await prepareBuild(outputBuild);
      const importedReplay = simulateGw2({
        profession: imported.profession,
        config: imported.config,
        rotation: exported.rotation
      });
      assert.equal(
        importedReplay.totalDamage,
        replay.totalDamage,
        'exported build must recalculate to identical combat values'
      );
      await invoke('status');
      await assert.rejects(invoke('init', '--example'), /already exists/);
      await assert.rejects(invoke('search', '--workers', '0'), /between/);
      const release = await lockRun(run, 'test');
      await assert.rejects(invoke('status'), /locked/);
      await release();
      // Incompatible training data and modified assumptions must fail before further work.
      await copyFile(path.join(run, 'dataset.jsonl'), path.join(temporary, 'dataset-backup.jsonl'));
      await writeFile(path.join(run, 'dataset.jsonl'), '{incomplete', { flag: 'a' });
      await assert.rejects(invoke('train'), /incomplete or invalid/);
      const changed = await readJson(path.join(run, 'scenario.json'));
      changed.seconds = 99;
      await writeJson(path.join(run, 'scenario.json'), changed);
      await assert.rejects(invoke('status'), /has changed/);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }
);

test('paired seed summaries preserve pairing and calculate uncertainty of the improvement', () => {
  const result = pairedSummary([10, 100, 1000], [12, 102, 1002]);
  assert.equal(result.meanGain, 2);
  assert.equal(result.standardErrorOfGain, 0);
  assert.throws(() => pairedSummary([1], [2]), /at least two/);
});

test(
  'three real builds share one profession model across trait and specialization changes',
  { timeout: 120000 },
  async () => {
    const temporary = await mkdtemp(path.join(tmpdir(), 'profession-ai-'));
    const models = path.join(temporary, 'models');
    const invoke = (run, ...args) =>
      exec(process.execPath, ['scripts/analysis/rotation-ai/cli.mjs', ...args, '--run', run, '--models', models], {
        cwd: root,
        maxBuffer: 4 * 1024 * 1024
      });
    try {
      const original = await readJson(path.join(root, 'data/gw2/builds/engineer/b-power-core-hammer.json'));
      const traits = structuredClone(original);
      traits.specializations[0].traits = '1-1-1';
      const holo = structuredClone(original);
      holo.specializations[2] = { name: 'Holosmith', traits: '1-1-1' };
      const seed = path.join(temporary, 'seed.json');
      await writeJson(seed, { rotation: ['Grenade Kit', ...Array(7).fill('Grenade')] });
      const runs = [];
      for (const [index, build] of [original, traits, holo].entries()) {
        const file = path.join(temporary, `build-${index}.json`);
        const run = path.join(temporary, `run-${index}`);
        runs.push(run);
        await writeJson(file, build);
        await invoke(run, 'init', '--build', file, '--rotation', seed, '--seconds', '12');
        await invoke(run, 'collect', '--evaluations', '160', '--workers', '2');
      }

      const contexts = await Promise.all(runs.map((run) => loadRun(run)));
      assert.notDeepEqual(contexts[0].config.selectedTraitIds, contexts[1].config.selectedTraitIds);
      assert.equal(contexts[2].config.specialization, 'Holosmith');
      // Legacy per-run weights do not replace shared models or prevent reusing scored data.
      await writeJson(path.join(runs[0], 'model.json'), { schema: 1, kind: 'rotation-damage-mlp' });
      await invoke(runs[0], 'train', '--training-run', runs[1], '--training-run', runs[2], '--epochs', '20');
      const modelFile = path.join(models, 'engineer', 'model.json');
      const model = await readJson(modelFile);
      assert.equal(model.profession, 'engineer');
      assert.equal(model.metrics.builds, 3);
      assert.equal(model.metrics.scenarios, 3);
      assert.equal(model.metrics.validationMode, 'held-out-builds');
      assert.ok(model.metrics.validationBuilds.every((key) => !model.metrics.trainingBuilds.includes(key)));
      await invoke(runs[1], 'search', '--evaluations', '8', '--workers', '1');
      await invoke(runs[2], 'search', '--evaluations', '8', '--workers', '1');
      assert.deepEqual(
        await readJson(modelFile),
        model,
        'trait and specialization changes reuse the existing weights without retraining'
      );
      await assert.rejects(access(path.join(runs[1], 'model.json')), { code: 'ENOENT' });
      const replay = await createEvaluator(contexts[2]);
      const exported = await readJson(path.join(runs[2], 'best.rotation.json'));
      assert.equal(replay.run(exported.rotation, { detailed: true }).warnings.length, 0);
      const manifest = await readJson(path.join(root, 'data/gw2/builds/mesmer/manifest.json'));
      const preset = manifest.flatMap((section) => section.presets).find((entry) => entry.rotation);
      const mesmer = path.join(temporary, 'mesmer');
      await invoke(mesmer, 'init', '--build', preset.build, '--rotation', preset.rotation, '--seconds', '10');
      await assert.rejects(invoke(runs[0], 'train', '--training-run', mesmer), /share profession/);
      assert.deepEqual(await readJson(modelFile), model);
      await assert.rejects(access(path.join(models, 'engineer', 'run.lock')), { code: 'ENOENT' });
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }
);
