import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { lifeForcePercent } from '#tests/helpers/necromancer-resource.js';
import { projectObservedState } from '#tests/helpers/observed-runtime.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import assert from 'node:assert/strict';
import test from 'node:test';

// Public normalization must detach retained values without changing the actual resource owner.
test('Necromancer planning projection normalizes resources without mutating live state', () => {
  const core = necromancerProfession.resolveProfession({}).createState({}).core;
  const harbinger = necromancerProfession.runtimeFor({ specialization: 'Harbinger' }).createState({})
    .specialization.state;
  core.lifeForce.value = core.lifeForce.maximum * 1.5;
  harbinger.blightExpiries = Array.from({ length: 27 }, (_, index) => index);
  const profession = { core, specialization: { kind: 'Harbinger', state: harbinger } };
  const before = structuredClone(profession);
  const planning = projectObservedState(necromancerProfession, { profession });
  assert.equal(lifeForcePercent(planning[STATE.LIFE_FORCE]), 100);
  assert.equal(planning[STATE.BLIGHT], 25);
  assert.deepEqual(planning[STATE.BLIGHT_EXPIRIES], harbinger.blightExpiries.slice(-25));
  planning[STATE.LIFE_FORCE].value = 0;
  planning[STATE.BLIGHT_EXPIRIES].push(99);
  planning[STATE.ACTIVE_MINIONS].fixture = 1;
  assert.deepEqual(profession, before);
});
