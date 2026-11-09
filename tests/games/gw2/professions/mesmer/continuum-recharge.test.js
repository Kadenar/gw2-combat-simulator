import assert from 'node:assert/strict';
import test from 'node:test';

import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { simulateMesmer } from '#tests/helpers/mesmer-simulation.js';

// Native signet resets and recasts inside Split must not replace the saved recharge restored by either exit.
test('Continuum restores cleared or restarted recharge once through manual and automatic exits', () => {
  const config = {
    specialization: 'Chronomancer',
    primaryWeapon: 'Staff',
    secondaryWeapon: '',
    initialResource: 3,
    selectedTraitIds: []
  };
  const prefix = ['Phantasmal Warlock', { type: 'wait', durationMs: 1000 }, 'Continuum Split'];
  const before = simulateMesmer(prefix, config);
  assert.deepEqual(before.warnings, []);
  const split = before.events.find((event) => event.type === 'marker' && event.name === 'Continuum Split');
  assert.ok(before.planningState.cooldownsBySkillId[ID.PHANTASMAL_WARLOCK]);

  const resetRotation = [...prefix, 'Signet of the Ether'];
  const reset = simulateMesmer(resetRotation, config);
  assert.deepEqual(reset.warnings, []);
  assert.equal(reset.planningState.profession[STATE.CONTINUUM_ACTIVE], true);
  assert.equal(reset.planningState.cooldownsBySkillId[ID.PHANTASMAL_WARLOCK], undefined);

  for (const restart of [false, true]) {
    const duringRotation = [...resetRotation, ...(restart ? ['Phantasmal Warlock'] : [])];

    if (restart) {
      const during = simulateMesmer(duringRotation, config);
      assert.deepEqual(during.warnings, []);
      assert.equal(during.planningState.profession[STATE.CONTINUUM_ACTIVE], true);
      assert.ok(
        during.planningState.cooldownsBySkillId[ID.PHANTASMAL_WARLOCK].readyAtMs >
          before.planningState.cooldownsBySkillId[ID.PHANTASMAL_WARLOCK].readyAtMs
      );
    }

    for (const exit of [['Continuum Shift'], [{ type: 'wait', durationMs: 7000 }]]) {
      const rotation = [...duringRotation, ...exit];
      const restored = simulateMesmer(rotation, config);
      assert.deepEqual(restored.warnings, []);
      assert.equal(restored.planningState.profession[STATE.CONTINUUM_ACTIVE], false);
      const shifts = restored.events.filter((event) => event.type === 'marker' && event.name === 'Continuum Shift');
      assert.equal(shifts.length, 1);
      const elapsed = Math.round((shifts[0].at - split.at) * 1000);

      for (const id of [ID.CONTINUUM_SPLIT, ID.PHANTASMAL_WARLOCK]) {
        assert.equal(
          restored.planningState.cooldownsBySkillId[id].readyAtMs,
          before.planningState.cooldownsBySkillId[id].readyAtMs + elapsed
        );
      }

      const phantasmRecast = simulateMesmer([...rotation, 'Phantasmal Warlock'], config);
      assert.deepEqual(phantasmRecast.warnings, []);
      assert.equal(
        phantasmRecast.steps.at(-1).start,
        restored.planningState.cooldownsBySkillId[ID.PHANTASMAL_WARLOCK].readyAtMs
      );

      // Waiting past the original expiry cannot restore an already closed checkpoint again.
      const waitedRotation = [...rotation, { type: 'wait', durationMs: 7000 }];
      const waited = simulateMesmer(waitedRotation, config);
      assert.deepEqual(waited.warnings, []);
      assert.equal(
        waited.events.filter((event) => event.type === 'marker' && event.name === 'Continuum Shift').length,
        1
      );
      const splitReadyAt = restored.planningState.cooldownsBySkillId[ID.CONTINUUM_SPLIT].readyAtMs;
      assert.equal(waited.planningState.cooldownsBySkillId[ID.CONTINUUM_SPLIT].readyAtMs, splitReadyAt);

      const splitRecast = simulateMesmer([...waitedRotation, 'Continuum Split'], config);
      assert.deepEqual(splitRecast.warnings, []);
      assert.equal(splitRecast.steps.at(-1).start, splitReadyAt);
    }
  }
});
