import assert from 'node:assert/strict';
import test from 'node:test';

import { canonicalInterval, isTimeInWindow, isTimeKeyInWindow, timeKey } from '#kernel/core/clock.js';

// Scans sharing one normalized instant must keep the half-open rules of ordinary status windows.
test('time windows include their start, exclude their end, and allow unbounded endpoints', () => {
  for (const [at, startsAt, expiresAt, expected] of [
    [0.999999, 1, 2, false],
    [1, 1, 2, true],
    [1.999999, 1, 2, true],
    [2, 1, 2, false],
    [2, -Infinity, 2, false],
    [1, 1, Infinity, true],
    [5, -Infinity, Infinity, true]
  ]) {
    assert.equal(isTimeKeyInWindow(timeKey(at), startsAt, expiresAt), expected);
    assert.equal(isTimeInWindow(at, startsAt, expiresAt), expected);
  }
});

// A recurring owner must advance the clock instead of falling into same-time work or an invented delay.
test('recurring intervals require a positive canonical duration', () => {
  for (const interval of [0, -1, 0.0000004, Infinity, -Infinity, NaN]) {
    assert.throws(() => canonicalInterval(interval), RangeError);
  }

  assert.equal(canonicalInterval(0.000001), 0.000001);
  assert.equal(canonicalInterval(0.56 + 0.04), 0.6);
});
