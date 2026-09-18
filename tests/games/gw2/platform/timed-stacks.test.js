import assert from 'node:assert/strict';
import test from 'node:test';

import {
  activeStackCount,
  addTimedStacks,
  consumeNewestStacks,
  consumeOldestStacks,
  grantTimedStacks,
  purgeExpiredStacks
} from '#gw2/platform/combat/resources/timed-stacks.js';

test('purge and count drop applications expiring exactly at the observation time', () => {
  const expiries = [4, 5, 6];
  assert.deepEqual(purgeExpiredStacks(expiries, 5), [6]);
  assert.equal(activeStackCount(expiries, 5), 1);
  assert.deepEqual(expiries, [4, 5, 6], 'reads never prune caller-owned state');
});

test('addTimedStacks rejects the overflow while grantTimedStacks evicts for it', () => {
  const full = [10, 11, 12];
  assert.deepEqual(addTimedStacks(full, 2, 0, 20, 3), { expiries: [10, 11, 12], added: 0 });
  assert.deepEqual(
    grantTimedStacks(full, { at: 0, expiresAt: 20, count: 2, maximumStacks: 3, retain: 'newest-grant' }),
    [12, 20, 20]
  );
});

test('latest-expiry and newest-grant diverge once durations are unequal', () => {
  // The survivors outlast the grant, so the two policies disagree about which entry dies.
  const survivors = [30, 31, 32];
  const options = { at: 0, expiresAt: 5, count: 1, maximumStacks: 3 };

  assert.deepEqual(
    grantTimedStacks(survivors, { ...options, retain: 'latest-expiry' }),
    [32, 31, 30],
    'the short-lived grant is the entry discarded'
  );
  assert.deepEqual(
    grantTimedStacks(survivors, { ...options, retain: 'newest-grant' }),
    [31, 32, 5],
    'the oldest grant is discarded even though it outlasts the incoming one'
  );
});

test('latest-expiry returns descending deadlines and newest-grant preserves insertion order', () => {
  assert.deepEqual(
    grantTimedStacks([12, 10, 11], { at: 0, expiresAt: 13, count: 1, maximumStacks: 4, retain: 'latest-expiry' }),
    [13, 12, 11, 10]
  );
  assert.deepEqual(
    grantTimedStacks([12, 10, 11], { at: 0, expiresAt: 13, count: 1, maximumStacks: 4, retain: 'newest-grant' }),
    [12, 10, 11, 13]
  );
});

test('grantTimedStacks purges before granting so a stale entry never occupies the cap', () => {
  assert.deepEqual(
    grantTimedStacks([1, 2, 30], { at: 5, expiresAt: 25, count: 1, maximumStacks: 2, retain: 'newest-grant' }),
    [30, 25]
  );
});

test('a zero count prunes only and a zero cap empties the resource', () => {
  assert.deepEqual(
    grantTimedStacks([1, 30], { at: 5, expiresAt: 25, count: 0, maximumStacks: 5, retain: 'latest-expiry' }),
    [30]
  );
  assert.deepEqual(
    grantTimedStacks([30], { at: 5, expiresAt: 25, count: 1, maximumStacks: 0, retain: 'latest-expiry' }),
    []
  );
});

test('a grant already dead at the observation time is never retained', () => {
  for (const retain of ['latest-expiry', 'newest-grant']) {
    assert.deepEqual(grantTimedStacks([30], { at: 5, expiresAt: 5, count: 3, maximumStacks: 5, retain }), [30], retain);
  }
});

test('a grant larger than the cap keeps the newest entries under either policy', () => {
  assert.deepEqual(
    grantTimedStacks([30], { at: 0, expiresAt: 20, count: 9, maximumStacks: 2, retain: 'newest-grant' }),
    [20, 20]
  );
  assert.deepEqual(
    grantTimedStacks([30], { at: 0, expiresAt: 20, count: 9, maximumStacks: 2, retain: 'latest-expiry' }),
    [30, 20]
  );
});

test('consumeOldestStacks removes from the front and reports what it could take', () => {
  assert.deepEqual(consumeOldestStacks([1, 30, 31], 5, 5), { expiries: [], consumed: 2 });
});

test('the two consume policies take opposite ends and leave opposite survivors', () => {
  const expiries = [10, 20, 30];
  // Spending the newest leaves the stacks closest to expiring, which is the point of the distinction.
  assert.deepEqual(consumeOldestStacks(expiries, 2, 0), { expiries: [30], consumed: 2 });
  assert.deepEqual(consumeNewestStacks(expiries, 2, 0), { expiries: [10], consumed: 2 });
  assert.deepEqual(expiries, [10, 20, 30], 'neither policy prunes caller-owned state');
});

test('consumeNewestStacks purges first and cannot take more than is live', () => {
  assert.deepEqual(consumeNewestStacks([1, 30, 31], 5, 5), { expiries: [], consumed: 2 });
  assert.deepEqual(consumeNewestStacks([30, 31], 0, 5), { expiries: [30, 31], consumed: 0 });
});
