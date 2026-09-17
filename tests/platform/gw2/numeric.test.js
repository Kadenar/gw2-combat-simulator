import assert from 'node:assert/strict';
import test from 'node:test';

import { clamp, finiteNumber, roundHalfToEven } from '#gw2/platform/combat/numeric.js';

test('clamp restricts values to an inclusive range', () => {
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(4, 0, 10), 4);
  assert.equal(clamp(11, 0, 10), 10);
});

test('finiteNumber coerces numeric input and rejects non-finite results', () => {
  assert.equal(finiteNumber('12.5', 0), 12.5);
  assert.equal(finiteNumber('invalid', 7), 7);
  assert.equal(finiteNumber(Number.POSITIVE_INFINITY, -1), -1);
});

// Half ties tolerate arithmetic noise while distinct neighboring fractions keep nearest rounding.
test('damage rounding resolves half ties to even integers', () => {
  for (const [value, expected] of [
    [0, 0],
    [2.49, 2],
    [2.5, 2],
    [2.51, 3],
    [3.5, 4],
    [258.50000000000017, 258],
    [291.49999999999983, 292],
    [-258.50000000000017, -258],
    [-291.49999999999983, -292],
    [258.5 + 1e-8, 259],
    [291.5 - 1e-8, 291],
    [2 ** 50 + 0.75, 2 ** 50 + 1],
    [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
    [15.52, 16],
    [-2.5, -2],
    [-3.5, -4]
  ]) {
    assert.equal(roundHalfToEven(value), expected);
  }
});
