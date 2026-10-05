import assert from 'node:assert/strict';
import test from 'node:test';
import { addCounterProgress, advanceCounter, advanceCyclicCounter } from '#gw2/platform/combat/resources/counters.js';

// The arithmetic reports a crossing without owning eligibility, rewards, expiry or the caller's stored value.
test('additive progress remains independent of later reward checks', () => {
  assert.equal(addCounterProgress(2.5, 4), 6.5);
  assert.equal(addCounterProgress(2.5, -1), 1.5);
  assert.throws(() => addCounterProgress(0, NaN), RangeError);
  assert.throws(() => addCounterProgress(Infinity, 1), RangeError);
  assert.throws(() => addCounterProgress(Number.MAX_VALUE, Number.MAX_VALUE), RangeError);
});

// Capped progress waits at its threshold until an independently owned gate permits consumption.
test('capped progress preserves partial values and cannot bank above its cap', () => {
  assert.deepEqual(advanceCounter(4, 1, 6, 'cap'), { value: 5, reached: false });
  assert.deepEqual(advanceCounter(5, 1, 6, 'cap'), { value: 6, reached: true });
  assert.deepEqual(advanceCounter(6, 1, 6, 'cap'), { value: 6, reached: true });
});

test('retained progress reports below, exact and overshooting threshold values without clamping', () => {
  assert.deepEqual(advanceCounter(0, 1, 2.5, 'retain'), { value: 1, reached: false });
  assert.deepEqual(advanceCounter(1.5, 1, 2.5, 'retain'), { value: 2.5, reached: true });
  assert.deepEqual(advanceCounter(2, 1, 2.5, 'retain'), { value: 3, reached: true });
});

test('signed and nonpositive profile values retain arithmetic rather than imposing a disabled policy', () => {
  assert.deepEqual(advanceCounter(0, 1, 0, 'retain'), { value: 1, reached: true });
  assert.deepEqual(advanceCounter(0, 1, -1, 'retain'), { value: 1, reached: true });
  assert.deepEqual(advanceCounter(0.5, -1, 2, 'retain'), { value: -0.5, reached: false });
});

test('invalid inputs and overflowing progress fail before a value can be stored', () => {
  for (const invalid of [NaN, Infinity, -Infinity]) {
    assert.throws(() => advanceCounter(invalid, 1, 2, 'retain'), RangeError);
    assert.throws(() => advanceCounter(0, invalid, 2, 'retain'), RangeError);
    assert.throws(() => advanceCounter(0, 1, invalid, 'retain'), RangeError);
  }

  assert.throws(() => advanceCounter(0, 1, 2, 'unknown'), TypeError);
  assert.throws(() => advanceCounter(Number.MAX_VALUE, Number.MAX_VALUE, 2, 'retain'), RangeError);
});

// A completion starts the next cycle at zero; owners dispatch individual occurrences before advancing again.
test('reset progress keeps incomplete cycles and clears exact or overshooting completions', () => {
  assert.deepEqual(advanceCounter(0, 1, 2.5, 'reset'), { value: 1, reached: false });
  assert.deepEqual(advanceCounter(1.5, 1, 2.5, 'reset'), { value: 0, reached: true });
  assert.deepEqual(advanceCounter(2, 1, 2.5, 'reset'), { value: 0, reached: true });
  assert.deepEqual(advanceCounter(0, 1, 0, 'reset'), { value: 0, reached: true });
});

// Cumulative selectors use exact multiples, even when a profile changes the period between accepted events.
test('cyclic counters retain totals and select exact multiples without rounding or resetting', () => {
  assert.deepEqual(advanceCyclicCounter(4, 1, 5), { value: 5, reached: true });
  assert.deepEqual(advanceCyclicCounter(5, 1, 5), { value: 6, reached: false });
  assert.deepEqual(advanceCyclicCounter(5, 1, 3), { value: 6, reached: true });
  assert.deepEqual(advanceCyclicCounter(1, 1, 1.5), { value: 2, reached: false });
  assert.deepEqual(advanceCyclicCounter(2, 1, 1.5), { value: 3, reached: true });
  assert.deepEqual(advanceCyclicCounter(4, 1, 0), { value: 5, reached: false });
  assert.throws(() => advanceCyclicCounter(0, 1, Infinity), RangeError);
});
