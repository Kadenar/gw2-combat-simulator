import assert from 'node:assert/strict';
import test from 'node:test';

import { projectWorkCompletion } from '#kernel/core/rate-intervals.js';

// Each rate applies only to its own window; a later change cannot rewrite completed work.
test('completion preserves earned work across rate changes without mutating inputs', () => {
  const progress = Object.freeze({ workAnchorAt: 2, work: 10 });
  const intervals = Object.freeze([
    Object.freeze({ start: 2, end: 4, rate: 2 }),
    Object.freeze({ start: 4, end: 5, rate: 1 }),
    Object.freeze({ start: 5, end: Infinity, rate: 4 })
  ]);
  assert.equal(projectWorkCompletion(progress, intervals), 6.25);
  assert.deepEqual(progress, { workAnchorAt: 2, work: 10 });
});

// Partitioning one constant-rate window must not change when its work finishes.
test('completion is invariant to interval partitioning and leaves rounding to callers', () => {
  const progress = { workAnchorAt: 0, work: 1 };
  const single = projectWorkCompletion(progress, [{ start: 0, end: Infinity, rate: 3 }]);
  const split = projectWorkCompletion(progress, [
    { start: 0, end: 0.25, rate: 3 },
    { start: 0.25, end: Infinity, rate: 3 }
  ]);
  assert.equal(single, 1 / 3);
  assert.equal(split, single);
});

// A completed interval owns its endpoint, even if a subsequent rate differs or no later interval exists.
test('work finishing at an interval boundary needs no later coverage', () => {
  assert.equal(projectWorkCompletion({ workAnchorAt: -2, work: 6 }, [{ start: -2, end: 1, rate: 2 }]), 1);
});

// Completed progress returns its anchor without consuming a lazy rate provider.
test('nonpositive remaining work completes at its anchor without reading intervals', () => {
  const unread = {
    [Symbol.iterator]() {
      throw new Error('Completed progress must not read intervals.');
    }
  };
  for (const work of [0, -1]) assert.equal(projectWorkCompletion({ workAnchorAt: 2, work }, unread), 2);
});

// A finite pause spends time without changing the amount of work left for later intervals.
test('finite zero-rate intervals pause progress without losing earned work', () => {
  assert.equal(
    projectWorkCompletion({ workAnchorAt: 0, work: 6 }, [
      { start: 0, end: 1, rate: 2 },
      { start: 1, end: 5, rate: 0 },
      { start: 5, end: Infinity, rate: 2 }
    ]),
    7
  );
});

test('unfinished work rejects exhausted interval coverage', () => {
  assert.throws(
    () => projectWorkCompletion({ workAnchorAt: 0, work: 3 }, [{ start: 0, end: 1, rate: 2 }]),
    /Rate intervals must cover the remaining work/
  );
});
