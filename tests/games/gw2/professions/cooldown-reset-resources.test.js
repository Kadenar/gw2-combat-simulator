import assert from 'node:assert/strict';
import test from 'node:test';

import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';

// These focused rotations verify that the training-area command resets both standard recharge and profession resources.
test('cooldown reset refills shared life force for every Necromancer specialization', () => {
  for (const specialization of ['Core', 'Reaper', 'Scourge', 'Harbinger', 'Ritualist']) {
    const config = { specialization, initialResource: 25, selectedSkills: ['Plaguelands'] };
    const result = runGw2Runtime({
      profession: necromancerProfession.liveRuntimeFor(config),
      rotation: ['Plaguelands', { type: 'cooldown-reset' }],
      config
    });

    assert.deepEqual(result.warnings, [], specialization);
    assert.equal(
      result.planningState.profession.lifeForce.value,
      result.planningState.profession.lifeForce.maximum,
      specialization
    );
    assert.equal(result.planningState.cooldowns.Plaguelands, undefined, specialization);
  }
});

test('cooldown reset refills Specter shadow force and clears skill recharge', () => {
  // The registered live family owns Shadow Force and its reset.
  const config = { specialization: 'Specter', initialShadowForce: 0 };
  const result = runGw2Runtime({
    profession: thiefProfession.liveRuntimeFor(config),
    rotation: ['Siphon', 'Enter Shadow Shroud', { type: 'wait', durationMs: 1000 }, { type: 'cooldown-reset' }],
    config
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession.shadowClock.value, 100);
  assert.equal(result.planningState.cooldowns.Siphon, undefined);
});

test('cooldown reset restores Revenant energy only after combat starts', () => {
  // The registered live family owns Energy and its reset.
  const config = { specialization: 'Core', initialEnergy: 25 };
  const simulate = (rotation) =>
    runGw2Runtime({ profession: revenantProfession.liveRuntimeFor(config), rotation, config });

  const beforeCombat = simulate([{ type: 'cooldown-reset' }, { type: 'combat-start' }]);
  const inCombat = simulate([{ type: 'combat-start' }, { type: 'cooldown-reset' }]);

  assert.equal(beforeCombat.planningState.profession.energy.value, 25);
  assert.equal(inCombat.planningState.profession.energy.value, 100);
});
