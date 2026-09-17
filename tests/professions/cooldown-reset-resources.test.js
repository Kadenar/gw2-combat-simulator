import assert from 'node:assert/strict';
import test from 'node:test';

import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { thiefProfession } from '#gw2/professions/thief/definition.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';

// These focused rotations verify that the training-area command resets both standard recharge and profession resources.
test('cooldown reset refills shared life force for every Necromancer specialization', () => {
  for (const specialization of ['Core', 'Reaper', 'Scourge', 'Harbinger', 'Ritualist']) {
    const result = simulateGw2({
      profession: necromancerProfession,
      rotation: ['Plaguelands', { type: 'cooldown-reset' }],
      config: {
        specialization,
        initialResource: 25,
        selectedSkills: ['Plaguelands']
      }
    });

    assert.deepEqual(result.warnings, [], specialization);
    assert.equal(result.endState.profession.lifeForce, result.endState.profession.maximumLifeForce, specialization);
    assert.equal(result.endState.profession.resource, result.endState.profession.maximumLifeForce, specialization);
    assert.equal(result.endState.cooldowns.Plaguelands, undefined, specialization);
  }
});

test('cooldown reset refills Specter shadow force and clears skill recharge', () => {
  const result = simulateGw2({
    profession: thiefProfession,
    rotation: ['Siphon', 'Enter Shadow Shroud', { type: 'wait', durationMs: 1000 }, { type: 'cooldown-reset' }],
    config: {
      specialization: 'Specter',
      initialShadowForce: 0
    }
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.shadowForce, result.endState.profession.maximumShadowForce);
  assert.equal(result.endState.cooldowns.Siphon, undefined);
});

test('cooldown reset restores Revenant energy only after combat starts', () => {
  const simulate = (rotation) =>
    simulateGw2({
      profession: revenantProfession,
      rotation,
      config: { specialization: 'Core', initialEnergy: 25 }
    });

  const beforeCombat = simulate([{ type: 'cooldown-reset' }, { type: 'combat-start' }]);
  const inCombat = simulate([{ type: 'combat-start' }, { type: 'cooldown-reset' }]);

  assert.equal(beforeCombat.endState.profession.energy, 25);
  assert.equal(inCombat.endState.profession.energy, 100);
});
