import assert from 'node:assert/strict';
import test from 'node:test';

import { buffApplicationStacks } from '#gw2/platform/combat/boons.js';
import { RECIPIENT } from '#gw2/platform/constants.js';

const self = { includesSelf: true, includesSummons: false, companionIds: [] };
const grant = (at, duration, extra = {}) => ({ at, duration, resolvedAudience: self, ...extra });
const stacks = (history, at, options = {}) =>
  buffApplicationStacks(history, 'fury', at, 1, { ordered: true, ...options });

// Cached duration pools preserve caps, exact expiry, extension eligibility, and same-time appended grants.
test('accepted duration queries advance grants without reviving expired pools', () => {
  const history = [grant(0, 25), grant(1, 20)];
  assert.equal(stacks(history, 0), 1);
  assert.equal(stacks(history, 1), 1);
  assert.equal(stacks(history, 30.999999), 1);
  assert.equal(stacks(history, 31), 0);
  history.push(grant(31, 5, { extension: true }));
  assert.equal(stacks(history, 31), 0);
  history.push(grant(32, 1));
  assert.equal(stacks(history, 32), 1);
  history.push(grant(32, 2, { extension: true }));
  assert.equal(stacks(history, 34.999999), 1);
  assert.equal(stacks(history, 35), 0);
  assert.equal(stacks(history, 0.5), 1);
  assert.equal(stacks(history, 31), 0);
  assert.equal(stacks(history, 34), 1);
  assert.equal(buffApplicationStacks(history, 'fury', 34, 0, { ordered: true }), 0);
});

// Each recipient gets an independent pool; unknown companion ownership differs from an aggregate summon query.
test('duration checkpoints isolate recipient and boon cap selections', () => {
  const history = [
    grant(0, 40),
    grant(1, 2, { resolvedAudience: { includesSelf: false, includesSummons: true, companionIds: ['a'] } }),
    grant(2, 4, { resolvedAudience: { includesSelf: false, includesSummons: true, companionIds: ['b'] } })
  ];
  const summon = (companionId) => ({ audience: RECIPIENT.SUMMONS, companionId });
  assert.equal(stacks(history, 2, summon('a')), 1);
  assert.equal(stacks(history, 2, summon(null)), 0);
  assert.equal(stacks(history, 3, summon('a')), 0);
  assert.equal(stacks(history, 3, summon('b')), 1);
  assert.equal(stacks(history, 3, summon(undefined)), 1);
  assert.equal(stacks(history, 30), 0);
  assert.equal(buffApplicationStacks(history, 'swiftness', 30, 1, { ordered: true }), 1);
  assert.equal(stacks(history, 1, summon('b')), 0);
  assert.equal(stacks(history, 6, summon('b')), 0);
});

// Dynamic callbacks are evaluated afresh, while append-only queries must agree with uncached replay in either direction.
test('cached queries agree with replay and do not cache custom callbacks', () => {
  const history = [];
  for (let index = 0; index < 80; index++) {
    const at = index * 0.173;
    history.push(grant(at, index % 3 ? 0.011 : 0.281, { extension: index % 5 === 0 }));
    for (const time of [at, at + 0.01, at + 0.3, Math.max(0, at - 1), at + 0.02])
      assert.equal(stacks(history, time), buffApplicationStacks(history, 'fury', time, 1));
  }

  const custom = [grant(0, 1)];
  let visible = true;
  const includes = () => visible;
  assert.equal(stacks(custom, 0, { includes }), 1);
  visible = false;
  assert.equal(stacks(custom, 0, { includes }), 0);
  let duration = 3;
  const options = { duration: () => duration };
  assert.equal(stacks(custom, 2, options), 1);
  duration = 1;
  assert.equal(stacks(custom, 2, options), 0);
});
