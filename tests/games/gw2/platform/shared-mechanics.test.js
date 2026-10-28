import assert from 'node:assert/strict';
import test from 'node:test';

import {
  activeChargeCount,
  activeChargeGrants,
  consumeCharge,
  consumeChargeBatch,
  expireCharges,
  grantChargePool,
  grantCharges
} from '#gw2/platform/combat/resources/charges.js';
import { advanceDiscreteResource, resourceValueAt } from '#gw2/platform/combat/resources/clock.js';

// Canonical expiry closes entitlement even when addition drifts above an exact action tick or off-grid deadline.
for (const [at, duration, expiry] of [
  [0.56, 0.04, 0.6],
  [0.137, 5, 5.137]
]) {
  test(`charges close at canonical expiry ${expiry} without extending their lifetime`, () => {
    const grant = grantCharges(1, at + duration);
    assert.equal(grant.expiresAt, expiry);
    assert.equal(activeChargeCount(grant, expiry - 0.000001), 1);
    assert.equal(activeChargeCount(grant, expiry), 0);
    assert.equal(consumeCharge(grant, expiry), false);
    assert.equal(consumeChargeBatch([grant], expiry), undefined);
    assert.deepEqual(activeChargeGrants([grant], expiry), []);
    expireCharges(grant, expiry);
    assert.equal(grant.charges, 0);

    const inclusive = grantCharges(2, at + duration);
    expireCharges(inclusive, expiry, true);
    assert.equal(activeChargeCount(inclusive, expiry, true), 2);
    assert.equal(consumeCharge(inclusive, expiry, 0, true), true);
    assert.equal(consumeChargeBatch([inclusive], expiry, undefined, true), inclusive);
    expireCharges(inclusive, expiry + 0.000001, true);
    assert.equal(inclusive.charges, 0);
  });
}

test('charge readers and expiry compare canonical observations and deadlines', () => {
  const grant = { charges: 1, expiresAt: 0.56 + 0.04 };
  assert.equal(activeChargeCount(grant, 0.6), 0);
  assert.equal(consumeChargeBatch([grant], 0.6), undefined);
  expireCharges(grant, 0.6);
  assert.equal(grant.charges, 0);
  assert.equal(activeChargeCount(grantCharges(1, 0.1), 0.3 - 0.2), 0);
  assert.equal(activeChargeCount(grantCharges(1, 0.6), 0.56 + 0.04, true), 1);
});

test('canonical charge refresh resets expired ICDs and preserves live grants against old expiry work', () => {
  const prior = grantCharges(2, 0.56 + 0.04);
  assert.equal(consumeCharge(prior, 0.56, 0.04), true);
  assert.equal(prior.readyAt, 0.6);
  const live = grantCharges(1, 0.137 + 5, prior, 0.599999);
  assert.equal(live.charges, 2);
  assert.equal(live.readyAt, 0.6);
  assert.equal(consumeCharge(live, 0.599999, 0.04), false);
  expireCharges(live, 0.6);
  // Internal cooldowns remain blocked through their deadline even though this grant survives its old expiry.
  assert.equal(consumeCharge(live, 0.6, 0.04), false);
  assert.equal(consumeCharge(live, 0.600001, 0.04), true);
  assert.deepEqual(grantCharges(1, 0.137 + 5, prior, 0.6), { charges: 1, expiresAt: 5.137, readyAt: 0 });
});

test('independent charge grants free capacity exactly at canonical expiry', () => {
  const pool = { grants: {} };
  grantChargePool(pool, 'player', 0.56, 1, 0.04, 2);
  grantChargePool(pool, 'player', 0.56, 1, 1, 2);
  const survivor = pool.grants.player[1];
  grantChargePool(pool, 'player', 0.6, 1, 0.04, 2);
  assert.deepEqual(
    pool.grants.player.map((grant) => grant.expiresAt),
    [0.64, 1.56]
  );
  assert.equal(pool.grants.player[1], survivor);
  assert.equal(survivor.charges, 1);
});

test('charge refresh survives old expiry, preserves ICD, and keeps independent recipient grants isolated', () => {
  let grant = grantCharges(2, 5);
  assert.equal(consumeCharge(grant, 1, 2), true);
  grant = grantCharges(1, 10, grant, 2);
  assert.equal(consumeCharge(grant, 2, 2), false);
  expireCharges(grant, 5);
  assert.equal(consumeCharge(grant, 5, 2), true);
  assert.equal(grant.charges, 1);
  const pool = { grants: {} };
  grantChargePool(pool, 'player', 0, 2, 4);
  grantChargePool(pool, 'player', 1, 3, 6);
  grantChargePool(pool, 'ally:1', 0, 2, 4);
  assert.equal(consumeCharge(pool.grants.player[0], 2), true);
  assert.equal(pool.grants['ally:1'][0].charges, 2);
  const active = activeChargeGrants(pool.grants.player, 4);
  assert.deepEqual(
    active.map((value) => value.charges),
    [3]
  );
  active[0].charges = 1;
  assert.equal(consumeCharge(grantCharges(1, 4), 4), false);
  assert.equal(consumeCharge(grantCharges(1, 4), 4, 0, true), true);
});

// Expired observations cannot erase entitlement needed by a later completion with an earlier eligibility time.
test('charge queries are read-only and distinguish exclusive from inclusive expiry', () => {
  const grant = Object.freeze(grantCharges(2, 5));
  assert.equal(activeChargeCount(undefined, 0), 0);
  assert.equal(activeChargeCount(grant, 4), 2);
  assert.equal(activeChargeCount(grant, 5), 0);
  assert.equal(activeChargeCount(grant, 5, true), 2);
  assert.equal(activeChargeCount(grant, 6, true), 0);
  assert.equal(activeChargeCount(grant, 4), 2);
  assert.equal(activeChargeCount(grantCharges(0, 5), 4), 0);
});

// Captured batch references stay authoritative after partial spending and observe exhaustion even after removal.
test('batch consumption preserves identity and cannot spend a sibling through an exhausted or expired reference', () => {
  const selected = grantCharges(2, 5);
  const sibling = grantCharges(2, 5);
  const grants = [selected, sibling];
  const onlySelected = (grant) => grant === selected;
  assert.equal(
    consumeChargeBatch(grants, 1, () => false),
    undefined
  );
  assert.equal(selected.charges, 2);
  // The spent batch is returned so its owner can attribute the spend to that batch's grant.
  assert.equal(consumeChargeBatch(grants, 1, onlySelected), selected);
  assert.equal(grants[0], selected);
  assert.equal(selected.charges, 1);
  assert.equal(consumeChargeBatch(grants, 2, onlySelected), selected);
  assert.equal(selected.charges, 0);
  assert.equal(grants.length, 1);
  assert.equal(grants[0], sibling);
  assert.equal(consumeChargeBatch(grants, 3, onlySelected), undefined);
  assert.equal(consumeChargeBatch(grants, 5), undefined);
  assert.equal(sibling.charges, 2);
});

test('anchored accrual queries retain their original anchor', () => {
  const anchor = { value: 10, maximum: 100, rate: 3, updatedAt: 1 };
  resourceValueAt(anchor, 2);
  assert.equal(resourceValueAt(anchor, 4), 19);
  assert.equal(anchor.value, 10, 'queries must retain the original accrual anchor');
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
