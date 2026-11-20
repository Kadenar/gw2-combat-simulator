// Native and Procession strikes share familiar strength but retain player attributes and critical-hit rules.
import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';

function strike(source, power, ferocity) {
  const result = simulateGw2({
    profession: elementalistProfession,
    rotation: [
      { type: 'cast', skillId: source },
      { type: 'wait', durationMs: 5000 }
    ],
    config: {
      specialization: 'Evoker',
      selectedTraitIds: [],
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Dagger',
      startAttunement: 'Air',
      evokerElement: 'Air',
      initialEvokerEmpowered: 3,
      attributeInputs: baseAttributeInputs({ power, precision: 0, ferocity }),
      boons: {},
      target: { armor: 2597, health: 1000000, conditions: {} },
      randomness: { mode: 'deterministic', seed: 1 }
    },
    collectChartData: false
  });
  assert.deepEqual(result.warnings, []);
  return result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillId === ID.LIGHTNING_BLITZ && !event.procType
  );
}

test('Familiar strikes retain player attributes when replayed by Elemental Procession', () => {
  for (const source of [ID.LIGHTNING_BLITZ, ID.ELEMENTAL_PROCESSION]) {
    const base = strike(source, 1000, 0);
    assert.equal(base.actorType, 'player');
    assert.equal(base.weaponStrengthProfileId, 'summon.weapon-type-1');
    assert.equal(base.didCrit, true);
    assert.ok(strike(source, 2000, 0).damage > base.damage);
    assert.ok(strike(source, 1000, 750).damage > base.damage);
  }
});
