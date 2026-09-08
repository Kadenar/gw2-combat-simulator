import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { generationContext, createRotationGenerator } from '../../scripts/analysis/rotation-ai/generation.mjs';
import { createEvaluator } from '../../scripts/analysis/rotation-ai/engine.mjs';
import { readJson, writeJson, loadRun, readRecords, digest } from '../../scripts/analysis/rotation-ai/storage.mjs';
import { SimulationPool } from '../../scripts/analysis/rotation-ai/pool.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const buildPath = path.join(root, 'data/gw2/builds/guardian/b-power-luminary.json');
const exec = promisify(execFile);

test('Luminary generation derives actions from equipment, selected slots, and profession catalog links', async () => {
  const build = await readJson(buildPath);
  build.rotation = ['THIS IS NOT A SEED'];
  const context = await generationContext(build, 12);
  const generator = await createRotationGenerator(context);
  const evaluator = await createEvaluator(context);
  const ids = new Set(generator.actions.map((action) => action.skillId));
  for (const name of [
    'Enter Radiant Forge',
    'Exit Radiant Forge',
    'Dazzling Hammer',
    'Shining Spin',
    'Whirling Wrath',
    'Strike',
    'Vengeful Strike',
    'Wrathful Strike',
    'Swap Weapons',
    'Effulgent Stance'
  ]) {
    assert.ok(ids.has(evaluator.catalog.skillsByName.get(name).id), name);
  }

  for (const name of ['Purging Flames', 'Tome of Justice', 'Symbol of Swiftness'])
    assert.ok(!ids.has(evaluator.catalog.skillsByName.get(name).id), `unequipped: ${name}`);
  const changed = structuredClone(build);
  changed.weapons = ['Longbow', ''];
  changed.alternateWeapons = ['', ''];
  changed.startingWeaponSet = 1;
  changed.selectedSkills.Utility1 = 'Purging Flames';
  const other = await createRotationGenerator(await generationContext(changed, 12));
  const otherIds = new Set(other.actions.map((action) => action.skillId));
  assert.ok(otherIds.has(evaluator.catalog.skillsByName.get('Purging Flames').id));
  assert.ok(!otherIds.has(evaluator.catalog.skillsByName.get('Effulgent Stance').id));
  assert.ok(!otherIds.has(evaluator.catalog.skillsByName.get('Whirling Wrath').id));
  assert.ok(!otherIds.has(evaluator.catalog.skillsByName.get('Swap Weapons').id));
  const engineer = await readJson(path.join(root, 'data/gw2/builds/engineer/b-power-core-hammer.json'));
  await assert.rejects(generationContext(engineer, 12), /Luminary builds only/);
});

test('generated rotations are reproducible, diverse, legal, and occupy the whole combat window', async () => {
  const context = await generationContext(await readJson(buildPath), 12);
  const generator = await createRotationGenerator(context);
  const evaluator = await createEvaluator(context);
  const generated = [42, 43, 44].map((seed) => generator.generate(seed));
  assert.equal(new Set(generated.map((entry) => digest(entry.rotation))).size, 3);
  assert.deepEqual(generator.generate(42), generated[0]);
  const observedSkills = new Set();
  for (const entry of generated) {
    const result = evaluator.evaluate(entry.rotation, { detailed: true });
    assert.equal(result.valid, true, result.reason);
    assert.ok(result.score > 0);
    assert.ok(Math.abs(result.metrics.duration - 12) < 0.00001);
    const unpadded = evaluator.run([...context.prefix, ...entry.rotation], { detailed: true });
    assert.ok(Math.abs(unpadded.duration - 12) < 0.00001, 'construction fills the horizon without terminal padding');
    assert.deepEqual(unpadded.warnings, []);
    assert.equal(unpadded.combatStartTime, 0);
    assert.ok(entry.generation.idleSeconds < 2, 'no long artificial idle tail');
    for (const command of entry.rotation) {
      assert.ok(command.type === 'cast' || command.type === 'wait');
      assert.equal(command.offTarget, undefined);
      assert.equal(command.initialStateDurationMs, undefined);
      if (command.type === 'cast') observedSkills.add(evaluator.catalog.skillsById.get(command.skillId).name);
    }
  }

  assert.ok(observedSkills.has('Enter Radiant Forge'));
  assert.ok(observedSkills.has('Dazzling Hammer') || observedSkills.has('Gleaming Blade'));
  const pool = new SimulationPool(context, 2);
  try {
    const [first, second] = await Promise.all([pool.generate(42), pool.generate(43)]);
    assert.deepEqual(first.rotation, generated[0].rotation);
    assert.deepEqual(second.rotation, generated[1].rotation);
    assert.equal(first.score, evaluator.evaluate(first.rotation).score);
  } finally {
    await pool.close();
  }
});

test(
  'CLI initializes without a rotation, pools generated examples, trains, searches, resumes and verifies',
  { timeout: 120000 },
  async () => {
    const temporary = await mkdtemp(path.join(tmpdir(), 'luminary-generation-'));
    const run = path.join(temporary, 'run');
    const models = path.join(temporary, 'models');
    const invoke = (...args) =>
      exec(process.execPath, ['scripts/analysis/rotation-ai/cli.mjs', ...args, '--run', run, '--models', models], {
        cwd: root,
        maxBuffer: 4 * 1024 * 1024
      });
    try {
      const build = await readJson(buildPath);
      build.rotation = ['MUST NOT BE READ'];
      const file = path.join(temporary, 'build.json');
      await writeJson(file, build);
      await assert.rejects(
        invoke('init', '--from-scratch', '--build', file, '--rotation', 'missing.json'),
        /without --rotation/
      );
      await invoke('init', '--from-scratch', '--build', file, '--seconds', '8', '--population', '24', '--workers', '2');
      const scenario = await loadRun(run);
      assert.deepEqual(scenario.prefix, [{ type: 'combat-start' }]);
      const initial = await readRecords(run, scenario);
      assert.equal(initial.length, 24);
      assert.ok(initial.every((record) => record.valid && record.source === 'generated'));
      const baseline = await readJson(path.join(run, 'baseline.json'));
      assert.equal(baseline.score, Math.max(...initial.map((record) => record.score)));
      assert.equal(baseline.source, 'generated-population-best');
      const collection = await invoke('collect', '--evaluations', '16', '--restart-fraction', '1', '--workers', '2');
      assert.equal(
        collection.stdout.split('\n').filter((line) => line.includes('valid this batch;')).length,
        1,
        'the first fresh batch must not repeat the initial generation RNG stream'
      );
      const collected = await readRecords(run, scenario);
      assert.equal(collected.length, 40);
      assert.ok(collected.every((record) => record.valid && record.generation));
      await invoke('train', '--epochs', '20');
      const model = await readJson(path.join(models, 'guardian', 'model.json'));
      assert.equal(model.profession, 'guardian');
      assert.equal(model.metrics.scenarios, 1);
      assert.equal(model.metrics.trainingExamples + model.metrics.validationExamples, 40);
      await invoke('search', '--evaluations', '8', '--workers', '1', '--restart-fraction', '0.5');
      const checkpoint = await readJson(path.join(run, 'checkpoint.json'));
      await invoke('collect', '--evaluations', '4', '--workers', '2', '--restart-fraction', '1');
      assert.notEqual((await readJson(path.join(run, 'checkpoint.json'))).rngState, checkpoint.rngState);
      assert.equal((await readRecords(run, scenario)).length, 52);
      await invoke('verify', '--seeds', '2', '--workers', '2');
      const exported = await readJson(path.join(run, 'best.rotation.json'));
      const evaluator = await createEvaluator(scenario);
      const result = evaluator.run(exported.rotation, { detailed: true });
      assert.deepEqual(result.warnings, []);
      assert.ok(result.totalDamage >= baseline.score);
      assert.ok(Math.abs(result.duration - 8) < 0.00001);
      const report = await readJson(path.join(run, 'report.json'));
      assert.equal(report.baselineSource, 'generated-population-best');
      assert.equal(report.best.totalDamage, result.totalDamage);
      await assert.rejects(access(path.join(run, 'run.lock')), { code: 'ENOENT' });
      await assert.rejects(access(path.join(models, 'guardian', 'run.lock')), { code: 'ENOENT' });
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }
);
