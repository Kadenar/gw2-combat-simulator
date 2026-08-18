import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateSkillDamage, conditionTotalDamage } from '../../../js/platform/gw2/damage.js';

test('preview condition duration is clamped between base and double duration', () => {
  assert.equal(conditionTotalDamage('Bleeding', 1, 2, 0, -50), 44);
  assert.equal(conditionTotalDamage('Bleeding', 1, 2, 0, 150), 88);

  const preview = calculateSkillDamage(
    { name: 'Bleeding Preview', castTime: 1 },
    [
      {
        hit: 1,
        conditions: { Bleeding: { stacks: 1, duration: 2 } }
      }
    ],
    1000,
    { 'Condition Duration': { final: -50 } }
  );

  assert.equal(preview.conditionDetails[0].adjustedDuration, 2);
  assert.equal(preview.totalCondition, 44);
});
