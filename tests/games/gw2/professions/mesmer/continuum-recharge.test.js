import assert from 'node:assert/strict';
import test from 'node:test';

import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { simulateMesmer } from '#tests/helpers/mesmer-simulation.js';

// Either exit restores entry-time recharge once, replacing a Signet of the Ether reset and recast made inside Split.
test('Continuum exits restore entry-time recharge once over resets and recasts inside Split', () => {
  const config = {
    specialization: 'Chronomancer',
    primaryWeapon: 'Staff',
    secondaryWeapon: '',
    initialResource: 3,
    selectedTraitIds: []
  };
  const markers = (result, name) => result.events.filter((event) => event.type === 'marker' && event.name === name);
  const prefix = ['Phantasmal Warlock', { type: 'wait', durationMs: 1000 }, 'Continuum Split'];
  const entry = simulateMesmer(prefix, config);
  assert.deepEqual(entry.warnings, []);
  const [split] = markers(entry, 'Continuum Split');
  assert.ok(split);
  const entryReadyAt = (id) => entry.planningState.cooldownsBySkillId[id].readyAtMs;

  // Waiting past the original expiry after a manual Shift proves the stale expiry task cannot restore again.
  for (const exit of [['Continuum Shift'], []]) {
    const result = simulateMesmer(
      [
        ...prefix,
        'Signet of the Ether',
        'Phantasmal Warlock',
        ...exit,
        { type: 'wait', durationMs: 7000 },
        'Phantasmal Warlock',
        'Continuum Split'
      ],
      config
    );
    assert.deepEqual(result.warnings, []);
    const shifts = markers(result, 'Continuum Shift');
    assert.equal(shifts.length, 1);
    // Recharge earned inside Split is discarded, so each recast waits out its entry-time remainder after the exit.
    const elapsed = Math.round((shifts[0].at - split.at) * 1000);
    for (const [id, name] of [
      [ID.PHANTASMAL_WARLOCK, 'Phantasmal Warlock'],
      [ID.CONTINUUM_SPLIT, 'Continuum Split']
    ]) {
      assert.equal(result.steps.findLast((step) => step.skillName === name).start, entryReadyAt(id) + elapsed);
    }
  }
});
