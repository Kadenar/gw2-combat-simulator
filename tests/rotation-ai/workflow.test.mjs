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
      exec(process.execPath, ['scripts/analysis/rotation-ai/cli.mjs', ...args, '--run', run], {
        cwd: root,
        maxBuffer: 2 * 1024 * 1024
      });
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
      const model = await readJson(path.join(run, 'model.json'));
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
