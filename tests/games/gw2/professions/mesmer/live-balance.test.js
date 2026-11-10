// Released balance contracts preserve aura consumption and keep ammunition separate from damage.
import assert from 'node:assert/strict';
import test from 'node:test';

import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { runMesmer } from '#tests/helpers/mesmer-simulation.js';

const core = {
  specialization: 'Core',
  primaryWeapon: 'Staff',
  secondaryWeapon: '',
  initialResource: 3,
  selectedTraitIds: [TRAIT.SHAPER_OF_CHAOS, TRAIT.SHATTER_STORM],
  boons: {},
  target: { armor: 2597, conditions: {} }
};
const detonation = (result) =>
  result.resolvedEvents.filter((event) => event.sourceId === TRAIT.SHAPER_OF_CHAOS && event.type === 'condition');

test('Shaper of Chaos waits for F1 and consumes one active self Chaos Aura', () => {
  const auraOnly = runMesmer([ID.CHAOS_ARMOR], core);
  const used = runMesmer([ID.CHAOS_ARMOR, { type: 'wait', durationMs: 100 }, ID.MIND_WRACK, ID.MIND_WRACK], core);
  assert.deepEqual(auraOnly.warnings, []);
  assert.deepEqual(used.warnings, []);
  assert.equal(detonation(auraOnly).length, 0);
  assert.equal(
    detonation(used).reduce((sum, event) => sum + event.stacks, 0),
    6
  );
  assert.ok(detonation(used).every((event) => event.duration === 6));
});

test('Shaper of Chaos cannot detonate an expired or absent aura', () => {
  for (const rotation of [[ID.MIND_WRACK], [ID.CHAOS_ARMOR, { type: 'wait', durationMs: 5000 }, ID.MIND_WRACK]]) {
    const result = runMesmer(rotation, core);
    assert.deepEqual(result.warnings, []);
    assert.equal(detonation(result).length, 0);
  }
});

test('Shatter Storm changes Harmony ammunition without increasing its PvE damage', () => {
  const results = [[], [TRAIT.SHATTER_STORM]].map((selectedTraitIds) =>
    runMesmer([ID.BLADESONG_HARMONY, { type: 'wait', durationMs: 1500 }], {
      specialization: 'Virtuoso',
      initialResource: 5,
      selectedTraitIds
    })
  );
  for (const result of results) assert.deepEqual(result.warnings, []);
  assert.ok(results[0].totalDamage > 0);
  assert.equal(results[0].totalDamage, results[1].totalDamage);
});
