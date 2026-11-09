/** Exercise Haze transitions through native execution, planning state, and cooldown observations. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { REVENANT_SKILL_IDS as ID, REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runRevenant } from '#tests/helpers/revenant-simulation.js';

const config = {
  specialization: 'Conduit',
  selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
  startingLegend: LEGEND.ENTITY,
  initialEnergy: 100
};
const haze = ID.BEGUILING_HAZE;
const reset = { type: 'cooldown-reset' };

function run(rotation) {
  const result = runRevenant(rotation, config);
  assert.deepEqual(result.warnings, []);
  return result;
}

function assertMainReady(result) {
  const runtime = observedRuntime(result);
  const ammo = runtime.cooldownController.readAmmo(haze);
  assert.equal(result.planningState.profession[STATE.BEGUILING_HAZE_CHARGES], 0);
  assert.ok(result.planningState.profession[STATE.BEGUILING_HAZE_READY_AT] <= runtime.time);

  if (ammo) {
    assert.equal(ammo.maximum, 1);
    assert.equal(ammo.charges, 1);
    assert.equal(ammo.recharges.length, 0);
  }
}

for (const spent of [0, 1, 2]) {
  test(`reset preserves Haze's remaining follow-ups after ${spent} uses and releases a ready main skill`, () => {
    const prefix = [haze, ...Array(spent).fill(haze), reset];
    const afterReset = run(prefix);
    const remaining = 2 - spent;
    assert.equal(afterReset.planningState.profession[STATE.BEGUILING_HAZE_CHARGES], remaining);
    const ammo = observedRuntime(afterReset).cooldownController.readAmmo(haze);

    if (remaining > 0) assert.equal(ammo.charges, remaining);
    else assert.equal(ammo, undefined);

    const exhausted = [...prefix, ...Array(remaining).fill(haze)];
    assertMainReady(run(exhausted));

    // The next main activation establishes a fresh recharge and follow-up budget.
    const nextMain = run([...exhausted, haze]);
    assert.equal(nextMain.planningState.profession[STATE.BEGUILING_HAZE_CHARGES], 2);
    assert.ok(nextMain.planningState.profession[STATE.BEGUILING_HAZE_READY_AT] > observedRuntime(nextMain).time);
  });
}

test('reset before Haze readies the main skill without granting follow-ups', () => {
  const beforeCast = run([reset]);
  assertMainReady(beforeCast);
  assert.equal(Object.hasOwn(beforeCast.planningState.ammoBySkillId, haze), false);
  const result = run([reset, haze]);
  assert.equal(result.planningState.profession[STATE.BEGUILING_HAZE_CHARGES], 2);
  assert.ok(result.planningState.profession[STATE.BEGUILING_HAZE_READY_AT] > observedRuntime(result).time);
});

for (const withReset of [false, true]) {
  test(`cancelled Haze follow-up keeps its charge${withReset ? ' after reset' : ''}`, () => {
    const prefix = [haze, ...(withReset ? [reset] : [])];
    const baseline = run(prefix);
    const cancelled = run([...prefix, { skillId: haze, interruptAfterMs: 0 }]);
    assert.equal(cancelled.planningState.profession[STATE.BEGUILING_HAZE_CHARGES], 2);
    assert.equal(
      cancelled.planningState.profession[STATE.BEGUILING_HAZE_READY_AT],
      baseline.planningState.profession[STATE.BEGUILING_HAZE_READY_AT]
    );
    const continued = run([...prefix, { skillId: haze, interruptAfterMs: 0 }, haze]);
    assert.equal(continued.planningState.profession[STATE.BEGUILING_HAZE_CHARGES], 1);
  });
}

test('Haze restores a ready main skill when its saved recharge expires during the follow-ups', () => {
  const prefix = [haze, { type: 'wait', durationMs: 20000 }];
  assert.equal(run(prefix).planningState.profession[STATE.BEGUILING_HAZE_CHARGES], 2);
  assertMainReady(run([...prefix, haze, haze]));
});

test('Haze with no main recharge returns to a ready main skill after its follow-ups', () => {
  const overrides = { catalog: (catalog) => withSkill(catalog, haze, { cooldown: 0 }) };
  const exhausted = runRevenant([haze, haze, haze], config, overrides);
  assert.deepEqual(exhausted.warnings, []);
  assertMainReady(exhausted);

  const nextMain = runRevenant([haze, haze, haze, haze], config, overrides);
  assert.deepEqual(nextMain.warnings, []);
  assert.equal(nextMain.planningState.profession[STATE.BEGUILING_HAZE_CHARGES], 2);
});
