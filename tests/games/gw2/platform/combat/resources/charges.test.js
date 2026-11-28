import assert from 'node:assert/strict';
import test from 'node:test';

import { gw2Time } from '#gw2/platform/combat/clock.js';
import { consumeCharge, createChargeGrant, refreshChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import {
  advanceResource,
  createDiscreteResourceClock,
  resourceAt,
  resourceRecoveryReadyAt,
  startDiscreteResource
} from '#gw2/platform/combat/resources/clock.js';
import { activeBatches, consumeBatchFromList } from '#kernel/resources/batch-list.js';
import { activeBatchCount, expireBatch, purgeExpiredBatch } from '#kernel/resources/batch.js';

// Canonical deadlines stay spendable through their timestamp, even when addition drifts around an action tick.
for (const [at, duration, expiry] of [
  [0.56, 0.04, 0.6],
  [0.137, 5, 5.16]
]) {
  test(`charges close after canonical expiry ${expiry} on the GW2 grid`, () => {
    const grant = createChargeGrant(2, at + duration);
    assert.equal(grant.expiresAt, gw2Time(expiry));
    assert.equal(activeBatchCount(grant, expiry - 0.04), 2);
    assert.equal(activeBatchCount(grant, expiry), 2);
    assert.equal(activeBatchCount(grant, expiry + 0.04), 0);
    assert.deepEqual(activeBatches([grant], expiry + 0.04, { order: 'earliest-expiry' }), []);
    purgeExpiredBatch(grant, expiry);
    assert.equal(consumeCharge(grant, expiry), true);
    assert.equal(consumeBatchFromList([grant], expiry), grant);
    assert.equal(consumeCharge(createChargeGrant(1, at + duration), expiry + 0.04), false);
    // Cleanup after the deadline's timestamp clears what gameplay at that timestamp could still spend.
    const cleaned = createChargeGrant(1, at + duration);
    expireBatch(cleaned, expiry);
    assert.equal(cleaned.count, 0);
    const stale = createChargeGrant(1, at + duration);
    purgeExpiredBatch(stale, expiry + 0.04);
    assert.equal(stale.count, 0);
  });
}

test('charge readers and expiry compare canonical observations and deadlines', () => {
  const grant = { count: 1, expiresAt: 0.56 + 0.04 };
  assert.equal(activeBatchCount(grant, 0.6), 1);
  assert.equal(consumeBatchFromList([{ ...grant }], 0.64), undefined);
  expireBatch(grant, 0.6);
  assert.equal(grant.count, 0);
  assert.equal(activeBatchCount(createChargeGrant(1, 0.1), 0.3 - 0.2), 1);
  assert.equal(activeBatchCount(createChargeGrant(1, 0.6), 0.56 + 0.04), 1);
});

test('canonical charge refresh resets expired ICDs and preserves live grants against old expiry work', () => {
  const prior = createChargeGrant(2, 0.56 + 0.04);
  assert.equal(consumeCharge(prior, 0.56, 0.04), true);
  assert.equal(prior.readyAt, 0.6);
  const live = refreshChargeGrant(prior, 1, 0.137 + 5, 0.56);
  assert.equal(live.count, 2);
  assert.equal(live.readyAt, 0.6);
  assert.equal(consumeCharge(live, 0.56, 0.04), false);
  expireBatch(live, 0.6);
  // Internal cooldowns remain blocked through their deadline even though this grant survives its old expiry.
  assert.equal(consumeCharge(live, 0.6, 0.04), false);
  assert.equal(consumeCharge(live, 0.64, 0.04), true);
  // A refresh at the old deadline keeps the tied entitlement and its cooldown; a later refresh starts fresh.
  assert.deepEqual(refreshChargeGrant(prior, 1, 0.137 + 5, 0.6), { count: 2, expiresAt: 5.16, readyAt: 0.6 });
  assert.deepEqual(refreshChargeGrant(prior, 1, 0.137 + 5, 0.64), {
    count: 1,
    expiresAt: 5.16,
    readyAt: 0
  });
});

test('charge refresh survives old expiry and preserves its internal cooldown', () => {
  let grant = createChargeGrant(2, 5);
  assert.equal(consumeCharge(grant, 1, 2), true);
  grant = refreshChargeGrant(grant, 1, 10, 2);
  assert.equal(consumeCharge(grant, 2, 2), false);
  expireBatch(grant, 5);
  assert.equal(consumeCharge(grant, 5, 2), true);
  assert.equal(grant.count, 1);
  assert.equal(consumeCharge(createChargeGrant(1, 4), 4), true);
  assert.equal(consumeCharge(createChargeGrant(1, 4), 4.000001), false);
});

// Expired observations cannot erase entitlement needed by a later completion with an earlier eligibility time.
test('charge queries are read-only and keep a grant through its deadline', () => {
  const grant = Object.freeze(createChargeGrant(2, 5));
  assert.equal(activeBatchCount(undefined, 0), 0);
  assert.equal(activeBatchCount(grant, 4), 2);
  assert.equal(activeBatchCount(grant, 5), 2);
  assert.equal(activeBatchCount(grant, 6), 0);
  assert.equal(activeBatchCount(grant, 4), 2);
  assert.equal(activeBatchCount(createChargeGrant(0, 5), 4), 0);
});

// GW2 grants keep finite deadlines while the kernel supports unbounded preview batches.
test('GW2 charge creation and refresh require finite deadlines and retain fractional counts', () => {
  const previous = createChargeGrant(0.5, 5);
  assert.deepEqual(previous, { count: 0.5, expiresAt: 5, readyAt: 0 });
  assert.throws(() => createChargeGrant(1, Infinity));
  assert.throws(() => refreshChargeGrant(previous, 1, Infinity, 1));
  assert.equal(consumeCharge(previous, 1, 2), true);
  assert.equal(previous.count, -0.5);
  assert.equal(previous.readyAt, 3);
  assert.equal(consumeCharge(previous, 4, 2), false);
});

// A refresh at the shared deadline retains the tied charges and cooldown without mutating the previous grant.
test('charge refresh at the deadline retains entitlement without mutating the previous grant', () => {
  const previous = { count: 2, expiresAt: 5, readyAt: 6 };
  const tied = refreshChargeGrant(previous, 1, 10, 5);
  const later = refreshChargeGrant(previous, 1, 10, 5.04);
  assert.deepEqual(tied, { count: 3, expiresAt: 10, readyAt: 6 });
  assert.deepEqual(later, { count: 1, expiresAt: 10, readyAt: 0 });
  assert.notEqual(tied, previous);
  assert.notEqual(later, previous);
  assert.deepEqual(previous, { count: 2, expiresAt: 5, readyAt: 6 });
});

test('discrete resources grant on 40 ms ticks without early tolerance or cadence drift', () => {
  const clock = { ...createDiscreteResourceClock(), maximum: 8, interval: 5 };
  assert.equal(resourceAt(clock, 10), 0);
  assert.equal(resourceRecoveryReadyAt(clock, 1, 0), null);
  startDiscreteResource(clock, 0);
  assert.equal(resourceAt(clock, 4.96), 0);
  assert.equal(resourceRecoveryReadyAt(clock, 1, 4.96), 5);
  assert.equal(resourceAt(clock, 5), 1);

  // Observing between ticks must preserve the nominal 50 ms cadence on the 40 ms grid.
  for (const partition of [[0.2], [0.07, 0.08, 0.119, 0.12, 0.2]]) {
    const state = { ...createDiscreteResourceClock(), maximum: 10, interval: 0.05, unitsPerTick: 2 };
    startDiscreteResource(state, 0);
    assert.equal(resourceAt(state, 0.079), 0);
    for (const at of partition) advanceResource(state, at);
    assert.equal(state.value, 8);
    assert.equal(state.nextAt, 0.28);
    assert.equal(state.tickDelay, 0.03);
  }
});

test('a full discrete resource keeps its recovery cadence after a spend', () => {
  const clock = { ...createDiscreteResourceClock(8), interval: 0.05, unitsPerTick: 2 };
  startDiscreteResource(clock, 0);
  advanceResource(clock, 0.08);
  assert.equal(clock.value, 8);
  clock.value -= 1;
  assert.equal(resourceRecoveryReadyAt(clock, 8, 0.1), 0.12);
  assert.equal(resourceAt(clock, 0.1), 7);
  assert.equal(resourceAt(clock, 0.12), 8);
});
