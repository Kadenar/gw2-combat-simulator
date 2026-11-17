import assert from 'node:assert/strict';
import test from 'node:test';

import { activeBatches, appendBatch, consumeBatchFromList } from '#kernel/resources/batch-list.js';
import { createBatch } from '#kernel/resources/batch.js';

// Filtering and ordering never change batch references or the input list, including canonical deadline ties.
for (const expiry of ['inclusive', 'exclusive']) {
  for (const order of ['insertion', 'earliest-expiry']) {
    test(`batch lists retain identity with ${expiry} expiry and ${order} order`, () => {
      const later = Object.freeze(createBatch(2, 10));
      const atDeadline = Object.freeze(createBatch(1, 0.56 + 0.04));
      const equalDeadline = Object.freeze(createBatch(1, 0.6));
      const unbounded = Object.freeze(createBatch(1, Infinity));
      const anotherUnbounded = Object.freeze(createBatch(1, Infinity));
      const original = Object.freeze([later, unbounded, atDeadline, equalDeadline, anotherUnbounded]);
      const policy = { expiry, order };
      const active = activeBatches(original, 0.6, policy);
      const expected = expiry === 'inclusive' ? [...original] : [later, unbounded, anotherUnbounded];

      if (order === 'earliest-expiry') expected.sort((a, b) => a.expiresAt - b.expiresAt);

      assert.deepEqual(active, expected);
      active.forEach((batch, index) => assert.equal(batch, expected[index]));
      const newBatch = Object.freeze(createBatch(1, 20));
      const appended = appendBatch(original, newBatch, 0.6, policy);
      assert.equal(appended.includes(newBatch), true);
      assert.deepEqual(original, [later, unbounded, atDeadline, equalDeadline, anotherUnbounded]);
    });
  }
}

// A new grant can land partially without replacing the registered object or refreshing older deadlines.
test('capped append trims only the incoming batch and retains its metadata', () => {
  const previous = Object.freeze({ ...createBatch(2, 5), source: { id: 'old' } });
  const source = { id: 'new' };
  const incoming = { ...createBatch(3, 8), source, startsAt: 1 };
  const original = Object.freeze([previous]);
  const policy = { expiry: 'exclusive', order: 'insertion', maximum: 4 };
  const batches = appendBatch(original, incoming, 1, policy);
  assert.equal(batches[0], previous);
  assert.equal(batches[1], incoming);
  assert.equal(incoming.count, 2);
  assert.equal(incoming.source, source);
  assert.equal(incoming.startsAt, 1);
  assert.deepEqual(original, [previous]);
  const rejected = Object.freeze(createBatch(1, 9));
  assert.deepEqual(appendBatch(batches, rejected, 1, policy), batches);
  assert.equal(rejected.count, 1);
  assert.deepEqual(appendBatch(batches, rejected, 1, { ...policy, maximum: 1 }), batches);
});

// Capacity follows the explicit expiry policy and the event clock, including exact equality.
for (const expiry of ['inclusive', 'exclusive']) {
  test(`capped append frees capacity at canonical ${expiry} expiry`, () => {
    const prior = createBatch(2, 0.56 + 0.04);
    const incoming = createBatch(3, 1);
    const batches = appendBatch([prior], incoming, 0.6, { expiry, order: 'earliest-expiry', maximum: 3 });
    assert.equal(incoming.count, expiry === 'inclusive' ? 1 : 3);
    assert.equal(batches.includes(prior), expiry === 'inclusive');
    assert.equal(prior.count, 2);
    assert.equal(consumeBatchFromList([prior], 0.6, { expiry }), expiry === 'inclusive' ? prior : undefined);
    assert.equal(prior.count, expiry === 'inclusive' ? 1 : 2);
  });
}

// Eligibility chooses the first live candidate without reordering siblings or discarding pending applications.
test('consumption preserves attribution and removes fractional exhaustion in place', () => {
  const pending = { ...createBatch(1, 5), startsAt: 2 };
  const expired = createBatch(1, 1);
  const selected = { ...createBatch(1.5, 5), startsAt: 1, cause: { id: 'application' } };
  const sibling = { ...createBatch(2, 5), startsAt: 1 };
  const batches = [pending, expired, selected, sibling];
  const policy = { expiry: 'exclusive', eligible: (batch) => batch.startsAt <= 1 };
  assert.equal(consumeBatchFromList(batches, 1, policy), selected);
  assert.equal(selected.count, 0.5);
  assert.equal(batches[2], selected);
  assert.equal(consumeBatchFromList(batches, 1, policy), selected);
  assert.equal(selected.count, -0.5);
  assert.deepEqual(batches, [pending, expired, sibling]);
  assert.equal(consumeBatchFromList(batches, 1, { expiry: 'exclusive', eligible: (b) => b === selected }), undefined);
  assert.equal(sibling.count, 2);
  assert.equal(consumeBatchFromList(batches, 2, { expiry: 'exclusive', eligible: (b) => b === pending }), pending);
  assert.equal(pending.count, 0);
  assert.deepEqual(batches, [expired, sibling]);
});

// Invalid capacity fails before mutation; expired grants and zero capacity admit nothing.
test('append rejects invalid capacity and does not admit empty or expired batches', () => {
  const batch = createBatch(1, 5);
  const policy = { expiry: 'exclusive', order: 'earliest-expiry' };
  for (const maximum of [-1, NaN]) assert.throws(() => appendBatch([], batch, 1, { ...policy, maximum }));
  assert.deepEqual(appendBatch([], batch, 1, { ...policy, maximum: 0 }), []);
  assert.deepEqual(appendBatch([], batch, 5, policy), []);
  assert.deepEqual(appendBatch([], createBatch(0, 5), 1, policy), []);
  assert.equal(batch.count, 1);
});
