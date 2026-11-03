import assert from 'node:assert/strict';
import test from 'node:test';

import { createCooldownController } from '#gw2/platform/execution/cooldowns.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { createContinuumController } from '#gw2/professions/mesmer/specializations/chronomancer/mechanics/continuum-split.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { bindTriggerPoints } from '#tests/helpers/trigger-points.js';

// Split owns its independent wall-time deadline while ordinary work rewinds and excluded live recharge continues.
test('Continuum restores its independent deadline once without competing recharge work', () => {
  const split = {
    ...mesmerProfession
      .runtimeFor({ specialization: 'Chronomancer' })
      .catalog.skills.find((skill) => skill.id === ID.CONTINUUM_SPLIT),
    cooldown: 60
  };
  const utility = { id: 980000, name: 'Utility', cooldown: 12 };
  const mimic = { id: ID.MIMIC, name: 'Mimic', cooldown: 30 };
  const skillsById = new Map([split, utility, mimic].map((skill) => [skill.id, skill]));
  const state = {
    traits: new Set(),
    time: 0,
    helpers: { skillsById },
    profession: { core: {}, specialization: { kind: 'Chronomancer', state: { continuum: null } } }
  };
  const cooldown = createCooldownController({
    clock: state,
    skillFor: (id) => skillsById.get(id),
    rechargeDuration: (skill) => skill.cooldown / 1.5,
    rechargeIntervals: (_skill, start, end) => [{ start, end, rate: 1.5 }]
  });
  bindTriggerPoints(state, mesmerProfession, { specialization: 'Chronomancer' });
  state.effects = captureEffectEmissions().effects;
  const continuum = createContinuumController({
    state,
    cooldownController: cooldown,
    unaffectedCooldownIds: new Set([mimic.id]),
    consumeResources: () => 0,
    durationPerSource: 3
  });
  for (const skill of [split, utility, mimic]) cooldown.startRecharge(skill, 0);
  state.time = 1;
  continuum.beginContinuumSplit(split, state.time);
  assert.equal(state.profession.specialization.state.continuum.recharge.timers.has(split.id), false);
  cooldown.clear(utility.id);
  cooldown.startRecharge(split, state.time, 150);
  cooldown.startRecharge(mimic, state.time, 45);
  state.time = 4;
  continuum.restoreContinuum(state.time, 'test');
  assert.equal(cooldown.readyAt(split.id), 43);
  assert.equal(cooldown.rechargeFor(split.id), undefined);
  assert.equal(cooldown.readyAt(utility.id), 11);
  assert.equal(cooldown.readyAt(mimic.id), 31);
  assert.equal(cooldown.isOnCooldown(utility.id), true);
  continuum.restoreContinuum(5, 'second exit');
  assert.equal(cooldown.readyAt(split.id), 43);
});
