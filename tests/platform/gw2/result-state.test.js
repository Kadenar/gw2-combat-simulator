import assert from 'node:assert/strict';
import test from 'node:test';

import { criticalChanceEventAt, timedBuffAt, timedBuffStacksAt } from '#gw2/platform/results/query.js';

test('critical chance query selects the next eligible player strike', () => {
  const before = { type: 'damage', at: 0.5, criticalChance: 0.4 };
  const after = { type: 'damage', at: 2, criticalChance: 0.75 };
  const result = {
    resolvedEvents: [
      before,
      { type: 'damage', at: 1.1, source: 'Clone', criticalChance: 1 },
      { type: 'damage', at: 1.2, independentSummonStrike: true, criticalChance: 1 },
      { type: 'damage', at: 1.3, critEligible: false, criticalChance: 0 },
      after
    ]
  };

  assert.equal(criticalChanceEventAt(result, 1000), after);
});

test('timed buff queries use the latest active application and sum live stacks', () => {
  const latest = { type: 'buff', kind: 'tracked', at: 2, duration: 5, stacks: 3 };
  const result = {
    events: [
      { type: 'buff', kind: 'tracked', at: 0, duration: 4, stacks: 2 },
      { type: 'buff', kind: 'other', at: 1, duration: 10, stacks: 10 },
      latest
    ]
  };

  assert.deepEqual(timedBuffAt(result, 'tracked', 3), { remaining: 4, event: latest });
  assert.equal(timedBuffStacksAt(result, 'tracked', 3), 5);
  assert.equal(timedBuffStacksAt(result, 'tracked', 4), 3);
  assert.equal(timedBuffAt(result, 'tracked', 7), null);
});
