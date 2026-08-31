import assert from 'node:assert/strict';
import test from 'node:test';
import { denySkillCast } from '#gw2/content/professions/lib/availability.js';

test('shared profession availability helper distinguishes permanent denial from timed retry', () => {
  const skill = { name: 'Shroud Skill' };

  assert.deepEqual(denySkillCast(skill, 'test.shroud-inactive', 'shroud is not active.'), {
    ready: false,
    retryAt: null,
    code: 'test.shroud-inactive',
    reason: 'Shroud Skill is unavailable — shroud is not active.'
  });
  assert.deepEqual(denySkillCast(skill, 'test.resource', 'resource is regenerating.', 12.5), {
    ready: false,
    retryAt: 12.5,
    code: 'test.resource',
    reason: 'Shroud Skill is unavailable — resource is regenerating.'
  });
});
