import assert from 'node:assert/strict';
import test from 'node:test';

import { activeBatchCount, consumeBatch, createBatch, expireBatch, refreshBatch } from '#kernel/resources/batch.js';

// Equivalent floating-point times share one deadline for reads, refresh, spending, and expiry.
for (const expiry of ['inclusive', 'exclusive']) {
  test(`batch operations use canonical ${expiry} deadlines`, () => {
    const prior = Object.freeze({ count: 2, expiresAt: 0.56 + 0.04 });
    assert.equal(activeBatchCount(prior, 0.599999, expiry), 2);
    assert.equal(activeBatchCount(prior, 0.6, expiry), expiry === 'inclusive' ? 2 : 0);
    assert.equal(activeBatchCount(prior, 0.600001, expiry), 0);
    assert.equal(activeBatchCount(createBatch(2, 0.1), 0.3 - 0.2, expiry), expiry === 'inclusive' ? 2 : 0);
    const result = refreshBatch(prior, 1, { at: 0.6, expiresAt: 0.137 + 5, expiry, maximum: 3 });
    assert.deepEqual(result, {
      batch: { count: expiry === 'inclusive' ? 3 : 1, expiresAt: 5.137 },
      refreshed: expiry === 'inclusive'
    });
    assert.notEqual(result.batch, prior);
    assert.deepEqual(prior, { count: 2, expiresAt: 0.56 + 0.04 });

    const spending = createBatch(2, 0.56 + 0.04);
    assert.equal(consumeBatch(spending, 1, 0.6, expiry), expiry === 'inclusive');
    expireBatch(spending, 0.6, expiry);
    assert.equal(spending.count, expiry === 'inclusive' ? 1 : 0);
    expireBatch(spending, 0.600001, expiry);
    assert.equal(spending.count, 0);
  });

  test(`batch refresh preserves ${expiry} capacity and unbounded windows`, () => {
    const prior = Object.freeze(createBatch(2, 5));
    const capped = refreshBatch(prior, 1, { at: 4, expiresAt: 9.001, expiry, maximum: 2 });
    assert.deepEqual(capped, { batch: { count: 2, expiresAt: 9.001 }, refreshed: true });
    expireBatch(capped.batch, 5, expiry);
    assert.equal(capped.batch.count, 2);
    assert.deepEqual(refreshBatch(prior, 1, { at: 6, expiresAt: 11, expiry, maximum: 0 }), {
      batch: { count: 0, expiresAt: 11 },
      refreshed: false
    });
    const unbounded = refreshBatch(prior, 1, { at: 6, expiresAt: Infinity, expiry, maximum: 3 });
    assert.deepEqual(unbounded, { batch: { count: 1, expiresAt: Infinity }, refreshed: false });
    expireBatch(unbounded.batch, 100, expiry);
    assert.equal(activeBatchCount(unbounded.batch, 100, expiry), 1);
    assert.deepEqual(refreshBatch(undefined, 2, { at: 0, expiresAt: 10, expiry }), {
      batch: { count: 2, expiresAt: 10 },
      refreshed: false
    });
    assert.equal(refreshBatch(createBatch(0, 5), 1, { at: 1, expiresAt: 10, expiry }).refreshed, false);
  });
}

// Registered references observe each spend, including exhaustion of fractional entitlement by a whole-unit spend.
test('batch spending mutates the retained object and admits no spend after exhaustion', () => {
  const batch = createBatch(2.5, 5);
  const retained = batch;
  assert.equal(consumeBatch(batch, 2, 1, 'exclusive'), true);
  assert.equal(retained.count, 0.5);
  assert.equal(consumeBatch(batch, 1, 1, 'exclusive'), true);
  assert.equal(retained.count, -0.5);
  assert.equal(activeBatchCount(batch, 1, 'exclusive'), 0);
  assert.equal(consumeBatch(batch, 1, 1, 'exclusive'), false);
  assert.equal(batch, retained);
  assert.equal(consumeBatch(undefined, 1, 1, 'exclusive'), false);
});

// Invalid quantities cannot enter arithmetic; infinite deadlines are supported without allowing infinite counts.
test('batch construction and refresh reject invalid quantities', () => {
  for (const count of [-1, NaN, Infinity]) assert.throws(() => createBatch(count, 5));
  for (const expiresAt of [NaN, -Infinity]) assert.throws(() => createBatch(1, expiresAt));
  for (const maximum of [-1, NaN])
    assert.throws(() => refreshBatch(undefined, 1, { at: 0, expiresAt: 5, expiry: 'exclusive', maximum }));
  for (const count of [0, -1, NaN, Infinity])
    assert.throws(() => consumeBatch(createBatch(1, 5), count, 0, 'exclusive'));
});
