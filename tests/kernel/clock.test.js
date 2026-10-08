import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalInterval } from '#kernel/core/clock.js';

// A recurring owner must advance the clock instead of falling into same-time work or an invented delay.
test('recurring intervals require a positive canonical duration', () => {
  for (const interval of [0, -1, 0.0000004, Infinity, -Infinity, NaN]) {
    assert.throws(() => canonicalInterval(interval), RangeError);
  }

  assert.equal(canonicalInterval(0.000001), 0.000001);
  assert.equal(canonicalInterval(0.56 + 0.04), 0.6);
});
