import assert from 'node:assert/strict';
import test from 'node:test';

import {
  anchorResourceClock,
  createResourceClock,
  resourceAnchor,
  resourceDepletionAt,
  resourceThresholdAt,
  resourceValueAt
} from '#kernel/resources/accrual.js';

test('anchored accrual queries retain their original anchor', () => {
  const anchor = { value: 10, maximum: 100, unitsPerSecond: 3, updatedAt: 1 };
  resourceValueAt(anchor, 2);
  assert.equal(resourceValueAt(anchor, 4), 19);
  assert.equal(anchor.value, 10, 'queries must retain the original accrual anchor');
});

// Settling observations changes the visible balance, but only a mutation replaces the accrual segment.
test('partitioned observations preserve accrual, recovery crossings, and depletion deadlines', () => {
  for (const rate of [3.3, -3.3]) {
    const pool = { value: 5, maximum: 20, unitsPerSecond: rate, updatedAt: 0 };
    anchorResourceClock(pool);
    const anchor = resourceAnchor(pool);
    const expected = resourceValueAt(pool, 1.25);
    const crossing = resourceThresholdAt(pool, 6, 0);
    const depletion = resourceDepletionAt(pool);
    for (const at of [0.125, 0.375, 1.25]) {
      pool.value = resourceValueAt(pool, at);
      pool.updatedAt = at;
    }

    assert.equal(pool.value, expected);
    assert.equal(resourceAnchor(pool), anchor);
    assert.equal(resourceThresholdAt(pool, 6, 1.25)?.at, crossing?.at);
    assert.equal(resourceThresholdAt(pool, 6, 1.25)?.funding, rate > 0 ? 'recovered' : undefined);
    assert.equal(resourceDepletionAt(pool), depletion);
  }
});

test('resource values respect capacity, recovery ceilings, and the zero floor', () => {
  const pool = { value: 2, maximum: 10, recoveryMaximum: 6, unitsPerSecond: 2, updatedAt: 0 };
  assert.equal(resourceValueAt(pool, 10), 6);
  assert.deepEqual(resourceThresholdAt(pool, 6, 0), { at: 2, funding: 'pending' });
  assert.equal(resourceThresholdAt(pool, 7, 0), null);
  assert.equal(resourceThresholdAt(pool, 11, 0), null);
  const granted = { ...pool, value: 9 };
  assert.equal(resourceValueAt(granted, 10), 9);
  assert.deepEqual(resourceThresholdAt(granted, 9, 0.125), { at: 0.125, funding: 'existing' });
  assert.equal(resourceThresholdAt(granted, 10, 0), null);
  assert.equal(resourceValueAt({ ...pool, recoveryMaximum: 20 }, 10), 10);
  assert.equal(resourceValueAt({ ...pool, unitsPerSecond: -2 }, 10), 0);
});

// Independent pools and renewed segments must never reuse another pool's saved anchor.
test('reanchoring a settled mutation changes only its own pool', () => {
  const first = { ...createResourceClock(8), unitsPerSecond: -2 };
  const second = { ...first };
  anchorResourceClock(first);
  anchorResourceClock(second);
  first.value = resourceValueAt(first, 1);
  first.updatedAt = 1;
  first.value += 1;
  first.unitsPerSecond = -1;
  anchorResourceClock(first);
  assert.equal(resourceDepletionAt(first), 8);
  assert.equal(resourceDepletionAt(second), 4);
  assert.equal(resourceValueAt(first, 2), 6);
  assert.equal(resourceValueAt(second, 2), 4);
  assert.notEqual(resourceAnchor(first), resourceAnchor(second));
});

test('continuous threshold projection stays unrounded and retains the crossing after observation', () => {
  const pool = { value: 0, maximum: 10, unitsPerSecond: 3, updatedAt: 0 };
  anchorResourceClock(pool);
  assert.deepEqual(resourceThresholdAt(pool, 1, 0), { at: 1 / 3, funding: 'pending' });
  pool.value = resourceValueAt(pool, 0.5);
  pool.updatedAt = 0.5;
  assert.deepEqual(resourceThresholdAt(pool, 1, 0.5), { at: 1 / 3, funding: 'recovered' });
  assert.deepEqual(resourceThresholdAt(pool, 0, 0.5), { at: 0.5, funding: 'existing' });
});

test('idle and draining pools cannot predict unfunded costs', () => {
  for (const unitsPerSecond of [0, -1]) {
    const pool = { value: 2, maximum: 10, unitsPerSecond, updatedAt: 0 };
    assert.deepEqual(resourceThresholdAt(pool, 1, 0.125), { at: 0.125, funding: 'existing' });
    assert.equal(resourceThresholdAt(pool, 3, 0), null);
    assert.equal(resourceDepletionAt(pool), unitsPerSecond < 0 ? 2 : Infinity);
  }
});

test('threshold validation rejects invalid queries without changing the pool or its anchor', () => {
  const pool = { value: 1, maximum: 10, unitsPerSecond: 2, updatedAt: 1 };
  anchorResourceClock(pool);
  const anchor = resourceAnchor(pool);
  const before = { ...pool };
  for (const cost of [-1, NaN, Infinity]) assert.throws(() => resourceThresholdAt(pool, cost, 1), RangeError);
  for (const at of [0, NaN, Infinity]) assert.throws(() => resourceThresholdAt(pool, 2, at), RangeError);
  assert.deepEqual(pool, before);
  assert.equal(resourceAnchor(pool), anchor);
});

// Equal timestamps do not imply equal funding: only recovery should receive the caller's detection rounding.
test('threshold funding distinguishes a direct grant from recovery completing at the query time', () => {
  const recovered = { value: 0, maximum: 10, unitsPerSecond: 5, updatedAt: 0 };
  const granted = { ...recovered, value: 0.5, updatedAt: 0.1 };
  assert.deepEqual(resourceThresholdAt(recovered, 0.5, 0.1), { at: 0.1, funding: 'recovered' });
  assert.deepEqual(resourceThresholdAt(granted, 0.5, 0.1), { at: 0.1, funding: 'existing' });
});

// Funding tolerance is decided before clock rounding; a small future crossing may already be affordable.
test('threshold funding preserves resource tolerance independently of its raw crossing time', () => {
  const pool = { value: 0, maximum: 10, unitsPerSecond: 1, updatedAt: 0 };
  const fundedCost = 0.08 + 5e-10;
  const pendingCost = 0.08 + 1e-7;
  assert.deepEqual(resourceThresholdAt(pool, fundedCost, 0.08), { at: fundedCost, funding: 'recovered' });
  assert.deepEqual(resourceThresholdAt(pool, pendingCost, 0.08), { at: pendingCost, funding: 'pending' });
});
