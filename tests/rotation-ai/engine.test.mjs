import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { makeScenario, createEvaluator, splitRotation } from '../../scripts/analysis/rotation-ai/engine.mjs';
import { SimulationPool } from '../../scripts/analysis/rotation-ai/pool.mjs';

const json = async (file) => JSON.parse(await readFile(new URL(`../../${file}`, import.meta.url), 'utf8'));

test('fixed-window scoring matches ordinary detailed replay, counts delayed damage, and rejects cheating', async () => {
  const build = await json('data/gw2/builds/engineer/b-power-core-hammer.json');
  const seed = ['Grenade Kit', 'Grenade', 'Grenade', 'Grenade'];
  const { scenario, baseline, evaluator } = await makeScenario(build, seed, 10, 'test-engine');
  const original = JSON.stringify(scenario);
  assert.equal(scenario.config.target.health, 0);
  assert.equal(scenario.combatStart, 0);
  assert.equal(scenario.endTime, 10);
  const detailed = evaluator.evaluate(baseline.rotation, { detailed: true });
  const replay = evaluator.run(detailed.exportedRotation, { detailed: true });
  assert.equal(replay.totalDamage, baseline.score);
  assert.equal(replay.duration, 10);
  assert.equal(replay.warnings.length, 0);
  assert.ok(replay.totalDamage >= evaluator.run([...scenario.prefix, ...baseline.rotation]).totalDamage);
  assert.equal(evaluator.evaluate([...baseline.rotation, { type: 'cooldown-reset' }]).valid, false);
  assert.equal(evaluator.evaluate([...baseline.rotation, { type: 'combat-start' }]).valid, false);
  assert.equal(evaluator.evaluate([...baseline.rotation, { type: 'wait', durationMs: 100000 }]).valid, false);
  assert.equal(evaluator.evaluate([{ ...baseline.rotation[1], doubleEdgeOutcome: 'success' }]).valid, false);
  assert.equal(evaluator.evaluate([{ ...baseline.rotation[1], initialStateDurationMs: 999999 }]).valid, false);
  assert.equal(evaluator.evaluate([{ ...baseline.rotation[1], offTarget: true }]).valid, false);
  assert.equal(evaluator.evaluate([{ type: 'cast', skillId: 'unknown' }]).valid, false);
  assert.equal(JSON.stringify(scenario), original, 'evaluation cannot mutate the experiment');
  assert.throws(() => splitRotation([{ type: 'combat-start' }, { type: 'combat-start' }]), /exactly one/);
  const pool = new SimulationPool(scenario, 2);
  try {
    const [first, second] = await Promise.all([pool.evaluate(baseline.rotation), pool.evaluate(baseline.rotation)]);
    assert.deepEqual(first, second);
    assert.equal(first.score, baseline.score);
  } finally {
    await pool.close();
  }
});

test('real Engineer, Elementalist, and Necromancer presets retain their precast and match full replay', async () => {
  for (const profession of ['engineer', 'elementalist', 'necromancer']) {
    const manifest = await json(`data/gw2/builds/${profession}/manifest.json`);
    const preset = manifest.flatMap((section) => section.presets).find((entry) => entry.rotation);
    const { scenario, baseline } = await makeScenario(
      await json(preset.build),
      await json(preset.rotation),
      20,
      'test-engine'
    );
    const evaluator = await createEvaluator(scenario);
    const checked = evaluator.evaluate(baseline.rotation, { detailed: true });
    assert.equal(checked.valid, true, `${profession}: ${checked.reason}`);
    assert.equal(checked.score, baseline.score, profession);
    assert.deepEqual(checked.exportedRotation.slice(0, scenario.prefix.length), scenario.prefix);
    assert.ok(Math.abs(checked.metrics.duration - scenario.endTime) < 0.00001);
  }
});

test('worker infrastructure failure rejects pending jobs instead of hanging the search', async () => {
  const pool = new SimulationPool({ profession: 'not-a-profession' }, 1, 1000);
  try {
    await assert.rejects(pool.evaluate([{ type: 'cast', skillId: 1 }]), /profession|null|worker/i);
  } finally {
    await pool.close();
  }
});
