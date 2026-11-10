// Exercise condition selection and active windows through the owner without unrelated combat or trait setup.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cleanseNecromancerSelfCondition,
  hasNecromancerSelfConditions,
  removeOldestNecromancerSelfConditions,
  transfer
} from '#gw2/professions/necromancer/core/mechanics/condition-management.js';

function context(selfConditions, time = 1) {
  return { time, profession: { core: { selfConditions, plagueSendingArmed: true } } };
}

test('active-condition queries exclude future and expired applications without mutating the ledger', () => {
  const applications = [{ condition: 'Bleeding', stacks: 1, appliedAt: 1, expiresAt: 2 }];
  const runtime = context(applications);
  for (const [at, active] of [
    [0, false],
    [1, true],
    [2, false]
  ]) {
    runtime.time = at;
    assert.equal(hasNecromancerSelfConditions(runtime), active);
    assert.equal(runtime.profession.core.selfConditions, applications);
    assert.equal(runtime.profession.core.plagueSendingArmed, true);
  }
});

test('application removal and type cleansing select differently after discarding inactive applications', () => {
  const applications = [
    { condition: 'Weakness', stacks: 1, appliedAt: 0, expiresAt: 1 },
    { condition: 'Vulnerability', stacks: 1, appliedAt: 2, expiresAt: 3 },
    { condition: 'Bleeding', stacks: 1, appliedAt: 0, expiresAt: 3 },
    { condition: 'Bleeding', stacks: 2, appliedAt: 0, expiresAt: 4 },
    { condition: 'Poisoned', stacks: 1, appliedAt: 0, expiresAt: 5 }
  ];
  const removal = context([...applications]);
  assert.equal(removeOldestNecromancerSelfConditions(removal, 1), 1);
  assert.deepEqual(removal.profession.core.selfConditions, applications.slice(3));
  const cleanse = context([...applications]);
  cleanseNecromancerSelfCondition(cleanse);
  assert.deepEqual(cleanse.profession.core.selfConditions, applications.slice(4));
  assert.equal(removal.profession.core.plagueSendingArmed, true);
  assert.equal(cleanse.profession.core.plagueSendingArmed, true);
});

test('transfer rejection precedes pruning while an admitted transfer excludes inactive applications', () => {
  const applications = [
    { condition: 'Weakness', stacks: 1, appliedAt: 0, expiresAt: 1 },
    { condition: 'Bleeding', stacks: 1, appliedAt: 2, expiresAt: 3 }
  ];
  const skill = { id: 1, name: 'Transfer fixture' };
  const emitted = [];
  const runtime = {
    ...context(applications),
    engagement: { hostileEffectsAllowed: () => true },
    effects: { emit: (effect) => emitted.push(effect) }
  };
  assert.equal(transfer(runtime, skill, 1, { skillId: skill.id, offTarget: true }), 0);
  assert.equal(runtime.profession.core.selfConditions, applications);
  assert.equal(transfer(runtime, skill, 1, { skillId: skill.id }), 0);
  assert.deepEqual(runtime.profession.core.selfConditions, []);
  assert.deepEqual(emitted, []);
  assert.equal(runtime.profession.core.plagueSendingArmed, true);
});
