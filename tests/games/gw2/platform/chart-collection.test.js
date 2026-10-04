import assert from 'node:assert/strict';
import test from 'node:test';
import { loadProfession } from '#gw2/profession-registry.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { EffectRecorder } from '#gw2/platform/results/effect-report.js';
import { planningBuffAt, planningBuffStacks } from '#gw2/platform/results/query.js';
import { buildTimeSeries } from '#gw2/app/results/charts/time-series-model.js';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';

// Optional chart collection must leave combat and the editor's single-boundary observations intact.
for (const [id, name, primaryWeapon, specialization = 'Core'] of [
  ['elementalist', 'Fireball', 'Staff'],
  ['engineer', 'Rifle Burst', 'Rifle'],
  ['guardian', 'Sword of Wrath', 'Sword'],
  ['mesmer', 'Mind Slash', 'Sword'],
  ['necromancer', 'Gravedigger', 'Greatsword', 'Reaper'],
  ['ranger', 'Splitblade', 'Axe'],
  ['revenant', 'Preparation Thrust', 'Sword'],
  ['thief', 'Heartseeker', 'Dagger'],
  ['warrior', 'Chop', 'Axe']
]) {
  test(`${id} editor output retains combat, APM, and planning without chart recording`, async (t) => {
    const profession = await loadProfession(id);
    const options = {
      profession,
      rotation: [{ type: 'cast', skillId: profession.catalog.skillsByName.get(name).id }],
      config: { specialization, primaryWeapon, stats: { power: 2000, precision: 2000, conditionDamage: 1000 } }
    };
    const complete = simulateGw2(options);
    // Any live or projected recording would defeat the editor's collection contract.
    const capture = t.mock.method(EffectRecorder.prototype, 'capture');
    const editor = simulateGw2({ ...options, collectChartData: false });
    assert.equal(capture.mock.callCount(), 0);
    assert.equal(editor.effectReport, null);
    assert.equal(editor.boonGeneration, null);
    assert.ok(editor.totalDamage > 0);
    assert.equal(editor.dps, complete.dps);
    assert.equal(editor.totalDamage, complete.totalDamage);
    assert.deepEqual(editor.rotationApm, complete.rotationApm);
    assert.deepEqual(editor.planningState, complete.planningState);
    assert.deepEqual(editor.warnings, []);
    assert.deepEqual(
      buildTimeSeries(editor, 250, { includeEffects: false }).dps,
      buildTimeSeries(complete, 250, { includeEffects: false }).dps
    );
    assert.throws(() => buildTimeSeries(editor), /require collected chart data/);
  });
}

test('editor effect snapshots preserve grants and expiry without a chart history', async () => {
  const profession = (await loadProfession('warrior')).runtimeFor({});
  const run = (atSeconds) =>
    runGw2Runtime({
      profession: {
        ...profession,
        initialize(runtime) {
          profession.initialize?.(runtime);
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'buff',
              kind: 'might',
              at: 0,
              duration: 5,
              stacks: 3,
              source: 'Test',
              sourceId: 'snapshot',
              actorType: 'player'
            }
          });
        }
      },
      rotation: [{ type: 'wait', durationMs: atSeconds * 1000 }],
      collectChartData: false
    });
  const live = run(2);
  assert.equal(planningBuffStacks(live.planningState, 'might'), 3);
  assert.equal(planningBuffAt(live.planningState, 'might').remaining, 3);
  assert.equal(planningBuffAt(run(5).planningState, 'might'), null);
});
