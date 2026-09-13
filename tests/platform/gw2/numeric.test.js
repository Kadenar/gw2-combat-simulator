import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clamp,
  consumeExpectedCriticalProgress,
  EXPECTED_CRITICAL_PROGRESS_TOLERANCE,
  finiteNumber,
  roundHalfToEven
} from '#gw2/platform/combat/numeric.js';

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

// Only exact half ties choose the even integer; neighboring values keep ordinary nearest rounding.
test('damage rounding resolves half ties to even integers', () => {
  for (const [value, expected] of [
    [0, 0],
    [2.49, 2],
    [2.5, 2],
    [2.51, 3],
    [3.5, 4],
    [15.52, 16],
    [-2.5, -2],
    [-3.5, -4]
  ]) {
    assert.equal(roundHalfToEven(value), expected);
  }
});

test('expected critical progress consumes floating-point thresholds consistently', () => {
  const state = { criticalProgress: 0 };
  let triggers = 0;
  const chance = 1 / 2100;

  for (let hit = 0; hit < 2100; hit += 1) {
    if (consumeExpectedCriticalProgress(state, chance)) triggers += 1;
  }

  assert.equal(triggers, 1);
  assert.ok(state.criticalProgress <= EXPECTED_CRITICAL_PROGRESS_TOLERANCE);
});

test('expected critical progress does not delay a modeled one-third chance', () => {
  const state = { criticalProgress: 0 };

  assert.equal(consumeExpectedCriticalProgress(state, 1 / 3), false);
  assert.equal(consumeExpectedCriticalProgress(state, 1 / 3), false);
  assert.equal(consumeExpectedCriticalProgress(state, 1 / 3), true);
  assert.equal(state.criticalProgress, 0);
});
