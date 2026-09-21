import assert from 'node:assert/strict';
import test from 'node:test';

import { criticalChanceEventAt, timedBuffAt, timedBuffStacksAt } from '#gw2/platform/results/query.js';

// Report queries share committed effect history and half-open lifetimes with combat queries.
test('result effects ignore predictions and retain older overlapping grants', () => {
  const resolvedAudience = {
    includesSelf: true,
    includesSummons: false,
    companionIds: [],
    alliedPlayerCount: 0,
    recipientCount: 1
  };
  const older = { type: 'buff', kind: 'tracked', at: 0, duration: 10, stacks: 2, resolvedAudience };
  const result = {
    events: [{ ...older, stacks: 99 }],
    resolvedEvents: [
      older,
      { ...older, at: 1, duration: 1, stacks: 3 },
      { ...older, at: 2, resolvedAudience: { ...resolvedAudience, includesSelf: false } }
    ]
  };
  assert.deepEqual(timedBuffAt(result, 'tracked', 3), { remaining: 7, event: older });
  assert.equal(timedBuffStacksAt(result, 'tracked', 3), 2);
  assert.equal(timedBuffAt(result, 'tracked', 10), null);
  assert.equal(timedBuffStacksAt(result, 'tracked', 10), 0);
  assert.equal(timedBuffStacksAt({ events: result.events, resolvedEvents: [] }, 'tracked', 3), 0);
});

// Extensions use combat's duration-pool and intensity rules while retaining the original source grant.
test('reported boon extensions preserve pooled duration and surviving grant identity', () => {
  const resolvedAudience = {
    includesSelf: true,
    includesSummons: false,
    companionIds: [],
    alliedPlayerCount: 0,
    recipientCount: 1
  };
  const might = { type: 'buff', kind: 'might', at: 0, duration: 4, stacks: 2, resolvedAudience };
  const fury = { type: 'buff', kind: 'fury', at: 1, duration: 2, stacks: 1, resolvedAudience };
  const result = {
    resolvedEvents: [
      might,
      { ...fury, at: 0 },
      fury,
      { ...might, at: 1, duration: 1, stacks: 3 },
      { type: 'boon_extension', at: 3, duration: 2 }
    ]
  };
  assert.deepEqual(timedBuffAt(result, 'might', 5), { remaining: 1, event: might });
  assert.deepEqual(timedBuffAt(result, 'fury', 5), { remaining: 1, event: fury });
  assert.equal(timedBuffStacksAt(result, 'might', 5), 2);
  assert.equal(timedBuffStacksAt(result, 'fury', 5), 1);
  assert.equal(timedBuffAt(result, 'fury', 6), null);
  assert.equal(timedBuffStacksAt(result, 'might', 6), 0);
});

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
  const resolvedAudience = {
    includesSelf: true,
    includesSummons: false,
    companionIds: [],
    alliedPlayerCount: 0,
    recipientCount: 1
  };
  const latest = { type: 'buff', kind: 'tracked', at: 2, duration: 5, stacks: 3, resolvedAudience };
  const result = {
    resolvedEvents: [
      { type: 'buff', kind: 'tracked', at: 0, duration: 4, stacks: 2, resolvedAudience },
      { type: 'buff', kind: 'other', at: 1, duration: 10, stacks: 10, resolvedAudience },
      latest
    ]
  };

  assert.deepEqual(timedBuffAt(result, 'tracked', 3), { remaining: 4, event: latest });
  assert.equal(timedBuffStacksAt(result, 'tracked', 3), 5);
  assert.equal(timedBuffStacksAt(result, 'tracked', 4), 3);
  assert.equal(timedBuffAt(result, 'tracked', 7), null);

  const rounded = {
    resolvedEvents: [{ type: 'buff', kind: 'tracked', at: 0.36, duration: 1.002, stacks: 1, resolvedAudience }]
  };
  assert.equal(timedBuffStacksAt(rounded, 'tracked', 1.399999), 1);
  assert.equal(timedBuffStacksAt(rounded, 'tracked', 1.4), 0);
});
