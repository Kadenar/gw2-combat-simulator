import assert from 'node:assert/strict';
import test from 'node:test';

import { consumeCharge, createChargeGrant, refreshChargeGrant } from '#gw2/platform/combat/resources/charges.js';
import { advanceDiscreteResource } from '#gw2/platform/combat/resources/clock.js';
import { activeBatches, consumeBatchFromList } from '#kernel/resources/batch-list.js';
import { activeBatchCount, expireBatch } from '#kernel/resources/batch.js';

// Canonical expiry closes entitlement even when addition drifts above an exact action tick or off-grid deadline.
for (const [at, duration, expiry] of [
  [0.56, 0.04, 0.6],
  [0.137, 5, 5.137]
]) {
  test(`charges close at canonical expiry ${expiry} without extending their lifetime`, () => {
    const grant = createChargeGrant(1, at + duration);
    assert.equal(grant.expiresAt, expiry);
    assert.equal(activeBatchCount(grant, expiry - 0.000001, 'exclusive'), 1);
    assert.equal(activeBatchCount(grant, expiry, 'exclusive'), 0);
    assert.equal(consumeCharge(grant, expiry, 'exclusive'), false);
    assert.equal(consumeBatchFromList([grant], expiry, { expiry: 'exclusive' }), undefined);
    assert.deepEqual(activeBatches([grant], expiry, { expiry: 'exclusive', order: 'earliest-expiry' }), []);
    expireBatch(grant, expiry, 'exclusive');
    assert.equal(grant.count, 0);

    const inclusive = createChargeGrant(2, at + duration);
    expireBatch(inclusive, expiry, 'inclusive');
    assert.equal(activeBatchCount(inclusive, expiry, 'inclusive'), 2);
    assert.equal(consumeCharge(inclusive, expiry, 'inclusive', 0), true);
    assert.equal(consumeBatchFromList([inclusive], expiry, { expiry: 'inclusive' }), inclusive);
    expireBatch(inclusive, expiry + 0.000001, 'inclusive');
    assert.equal(inclusive.count, 0);
  });
}

test('charge readers and expiry compare canonical observations and deadlines', () => {
  const grant = { count: 1, expiresAt: 0.56 + 0.04 };
  assert.equal(activeBatchCount(grant, 0.6, 'exclusive'), 0);
  assert.equal(consumeBatchFromList([grant], 0.6, { expiry: 'exclusive' }), undefined);
  expireBatch(grant, 0.6, 'exclusive');
  assert.equal(grant.count, 0);
  assert.equal(activeBatchCount(createChargeGrant(1, 0.1), 0.3 - 0.2, 'exclusive'), 0);
  assert.equal(activeBatchCount(createChargeGrant(1, 0.6), 0.56 + 0.04, 'inclusive'), 1);
});

test('canonical charge refresh resets expired ICDs and preserves live grants against old expiry work', () => {
  const prior = createChargeGrant(2, 0.56 + 0.04);
  assert.equal(consumeCharge(prior, 0.56, 'exclusive', 0.04), true);
  assert.equal(prior.readyAt, 0.6);
  const live = refreshChargeGrant(prior, 1, 0.137 + 5, 0.599999, 'exclusive');
  assert.equal(live.count, 2);
  assert.equal(live.readyAt, 0.6);
  assert.equal(consumeCharge(live, 0.599999, 'exclusive', 0.04), false);
  expireBatch(live, 0.6, 'exclusive');
  // Internal cooldowns remain blocked through their deadline even though this grant survives its old expiry.
  assert.equal(consumeCharge(live, 0.6, 'exclusive', 0.04), false);
  assert.equal(consumeCharge(live, 0.600001, 'exclusive', 0.04), true);
  assert.deepEqual(refreshChargeGrant(prior, 1, 0.137 + 5, 0.6, 'exclusive'), {
    count: 1,
    expiresAt: 5.137,
    readyAt: 0
  });
});

test('charge refresh survives old expiry and preserves its internal cooldown', () => {
  let grant = createChargeGrant(2, 5);
  assert.equal(consumeCharge(grant, 1, 'exclusive', 2), true);
  grant = refreshChargeGrant(grant, 1, 10, 2, 'exclusive');
  assert.equal(consumeCharge(grant, 2, 'exclusive', 2), false);
  expireBatch(grant, 5, 'exclusive');
  assert.equal(consumeCharge(grant, 5, 'exclusive', 2), true);
  assert.equal(grant.count, 1);
  assert.equal(consumeCharge(createChargeGrant(1, 4), 4, 'exclusive'), false);
  assert.equal(consumeCharge(createChargeGrant(1, 4), 4, 'inclusive', 0), true);
});

// Expired observations cannot erase entitlement needed by a later completion with an earlier eligibility time.
test('charge queries are read-only and distinguish exclusive from inclusive expiry', () => {
  const grant = Object.freeze(createChargeGrant(2, 5));
  assert.equal(activeBatchCount(undefined, 0, 'exclusive'), 0);
  assert.equal(activeBatchCount(grant, 4, 'exclusive'), 2);
  assert.equal(activeBatchCount(grant, 5, 'exclusive'), 0);
  assert.equal(activeBatchCount(grant, 5, 'inclusive'), 2);
  assert.equal(activeBatchCount(grant, 6, 'inclusive'), 0);
  assert.equal(activeBatchCount(grant, 4, 'exclusive'), 2);
  assert.equal(activeBatchCount(createChargeGrant(0, 5), 4, 'exclusive'), 0);
});

// GW2 grants keep finite deadlines while the kernel supports unbounded preview batches.
test('GW2 charge creation and refresh require finite deadlines and retain fractional counts', () => {
  const previous = createChargeGrant(0.5, 5);
  assert.deepEqual(previous, { count: 0.5, expiresAt: 5, readyAt: 0 });
  assert.throws(() => createChargeGrant(1, Infinity));
  assert.throws(() => refreshChargeGrant(previous, 1, Infinity, 1, 'exclusive'));
  assert.equal(consumeCharge(previous, 1, 'exclusive', 2), true);
  assert.equal(previous.count, -0.5);
  assert.equal(previous.readyAt, 3);
  assert.equal(consumeCharge(previous, 4, 'exclusive', 2), false);
});

// Refresh policy controls both retained charges and cooldown ownership at the shared deadline.
test('charge refresh applies its named expiry policy without mutating the previous grant', () => {
  const previous = { count: 2, expiresAt: 5, readyAt: 6 };
  const inclusive = refreshChargeGrant(previous, 1, 10, 5, 'inclusive');
  const exclusive = refreshChargeGrant(previous, 1, 10, 5, 'exclusive');
  assert.deepEqual(inclusive, { count: 3, expiresAt: 10, readyAt: 6 });
  assert.deepEqual(exclusive, { count: 1, expiresAt: 10, readyAt: 0 });
  assert.notEqual(inclusive, previous);
  assert.notEqual(exclusive, previous);
  assert.deepEqual(previous, { count: 2, expiresAt: 5, readyAt: 6 });
});

test('discrete resources grant on 40 ms ticks without early tolerance or cadence drift', () => {
  // An off-grid cadence retains its phase across observations, cap overflow, and later spending.
  assert.deepEqual(advanceDiscreteResource(0, 8, 5, 5, 4.99999), { value: 0, nextAt: 5 });
  assert.deepEqual(advanceDiscreteResource(0, 8, 5, 5, 5), { value: 1, nextAt: 10 });
  assert.deepEqual(advanceDiscreteResource(8, 8, Infinity, 5, 10), { value: 8, nextAt: Infinity });
  for (const partition of [[0.2], [0.07, 0.08, 0.119, 0.12, 0.2]]) {
    let state = { value: 0, nextAt: 0.05 };
    for (const at of partition) state = advanceDiscreteResource(state.value, 8, state.nextAt, 0.05, at);
    assert.deepEqual(state, { value: 4, nextAt: 0.25 });
  }

  assert.deepEqual(advanceDiscreteResource(0, 8, 0.05, 0.05, 0.079), { value: 0, nextAt: 0.05 });
  const full = advanceDiscreteResource(8, 8, 0.05, 0.05, 0.08);
  assert.deepEqual(full, { value: 8, nextAt: 0.1 });
  assert.deepEqual(advanceDiscreteResource(7, 8, full.nextAt, 0.05, 0.1), { value: 7, nextAt: 0.1 });
  assert.deepEqual(advanceDiscreteResource(7, 8, full.nextAt, 0.05, 0.12), { value: 8, nextAt: 0.15 });
});
