import assert from 'node:assert/strict';
import test from 'node:test';
import { createNecromancerCoreState } from '#gw2/professions/necromancer/core/state.js';
import { createHarbingerState } from '#gw2/professions/necromancer/specializations/harbinger/state.js';
import { projectNecromancerPlanningState } from '#gw2/professions/necromancer/family-state.js';

// Public normalization must detach retained values without changing the actual resource owner.
test('Necromancer planning projection normalizes resources without mutating live state', () => {
  const core = createNecromancerCoreState();
  const harbinger = createHarbingerState();
  core.lifeForce.value = 150;
  harbinger.blightExpiries = Array.from({ length: 27 }, (_, index) => index);
  const profession = { core, specialization: { kind: 'Harbinger', state: harbinger } };
  const before = structuredClone(profession);
  const planning = projectNecromancerPlanningState({ profession });
  assert.equal(planning.lifeForce.value, 100);
  assert.equal(planning.blight, 25);
  assert.deepEqual(planning.blightExpiries, harbinger.blightExpiries.slice(-25));
  planning.lifeForce.value = 0;
  planning.blightExpiries.push(99);
  planning.activeMinions.fixture = 1;
  assert.deepEqual(profession, before);
});
