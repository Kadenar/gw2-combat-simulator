import assert from 'node:assert/strict';
import test from 'node:test';
import { boundedInteger, boundedNumber, clamp, finiteNumber, roundHalfToEven } from '#kernel/core/numeric.js';

test('clamp restricts values to an inclusive range', () => {
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(4, 0, 10), 4);
  assert.equal(clamp(11, 0, 10), 10);
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

test('boundedNumber coerces scalars, preserves zero, and clamps to inclusive bounds', () => {
  assert.equal(boundedNumber('4.5', 2, 0, 5), 4.5);
  assert.equal(boundedNumber(0, 2, 0, 5), 0);
  assert.equal(boundedNumber('invalid', 2, 0, 5), 2);
  assert.equal(boundedNumber(Number.POSITIVE_INFINITY, 2, 0, 5), 5);
  assert.equal(boundedNumber(-1, 2, 0, 5), 0);
});

test('boundedInteger truncates before clamping and applies its fallback', () => {
  assert.equal(boundedInteger('4.9', 2, 0, 5), 4);
  assert.equal(boundedInteger('invalid', 2, 0, 5), 2);
  assert.equal(boundedInteger(Number.NEGATIVE_INFINITY, 2, 0, 5), 0);
});

test('finiteNumber coerces numeric input and rejects non-finite results', () => {
  assert.equal(finiteNumber('12.5', 0), 12.5);
  assert.equal(finiteNumber('invalid', 7), 7);
  assert.equal(finiteNumber(Number.POSITIVE_INFINITY, -1), -1);
});

// boundedNumber clamps an infinite input into range; finiteNumber takes the fallback instead.
test('finiteNumber and boundedNumber diverge on infinite input', () => {
  assert.equal(finiteNumber(Number.POSITIVE_INFINITY, 3), 3);
  assert.equal(boundedNumber(Number.POSITIVE_INFINITY, 3, 0, 5), 5);
});

test('bounded helpers substitute the fallback for input that coerces to NaN', () => {
  for (const unusable of ['abc', {}, [1, 2], undefined, Number.NaN]) {
    assert.equal(boundedInteger(unusable, 0, 0, 25), 0);
    assert.equal(boundedNumber(unusable, 8, 0, 8), 8);
  }

  // The shape these replaced: Math.min/Math.max propagate NaN rather than clamping it away.
  assert.ok(Number.isNaN(Math.max(0, Math.min(25, Math.trunc(Number('abc'))))));
});

test('bounded helpers leave usable input exactly as clamping did', () => {
  assert.equal(boundedInteger('7.9', 0, 0, 25), 7);
  assert.equal(boundedInteger(0, 5, 0, 25), 0);
  assert.equal(boundedInteger(99, 0, 0, 25), 25);
  assert.equal(boundedNumber('4.5', 2, 0, 5), 4.5);
  assert.equal(boundedNumber(-3, 0, 0, 5), 0);
});
