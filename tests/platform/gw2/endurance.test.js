import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceEndurance,
  advanceEnduranceIntervals,
  enduranceReadyAt,
  enduranceIntervalsReadyAt,
  grantEndurance,
  spendEndurance
} from '#gw2/platform/combat/resources/endurance.js';

test('endurance advancement caps regeneration and does not mutate or rewind its input', () => {
  const state = Object.freeze({ endurance: 40, enduranceUpdatedAt: 2 });

  assert.deepEqual(advanceEndurance(state, 8, 5, 60), {
    endurance: 60,
    enduranceUpdatedAt: 8
  });
  assert.deepEqual(advanceEndurance(state, 1, 5, 60), state);
  assert.deepEqual(state, { endurance: 40, enduranceUpdatedAt: 2 });
});

test('endurance spend and grant clamp values and carry their timestamps', () => {
  assert.deepEqual(spendEndurance({ endurance: 30, enduranceUpdatedAt: 2 }, 50, 4, 100), {
    endurance: 0,
    enduranceUpdatedAt: 4
  });
  assert.deepEqual(grantEndurance({ endurance: 80, enduranceUpdatedAt: 4 }, 50, 6, 100), {
    endurance: 100,
    enduranceUpdatedAt: 6
  });
});

test('endurance readiness honors epsilon and reports an unavailable zero-rate recovery', () => {
  assert.equal(enduranceReadyAt(49.99995, 50, 10, 5, 0.0001), 10);
  assert.equal(enduranceReadyAt(25, 50, 10, 5, 0.0001), 15);
  assert.equal(enduranceReadyAt(25, 50, 10, 0, 0.0001), null);
});

test('endurance intervals clip settled time and ignore empty windows and uncovered gaps', () => {
  // Neither replayed time nor gaps between supplied windows can earn endurance.
  const state = Object.freeze({ endurance: 20, enduranceUpdatedAt: 2 });
  const intervals = [
    { start: 0, end: 1, rate: 10 },
    { start: 1, end: 4, rate: 5 },
    { start: 4, end: 4, rate: 100 },
    { start: 4, end: 3, rate: 100 },
    { start: 6, end: 8, rate: 10 }
  ];
  assert.deepEqual(advanceEnduranceIntervals(state, intervals, 45), { endurance: 45, enduranceUpdatedAt: 8 });
  assert.equal(enduranceIntervalsReadyAt(state, 40, intervals, 45, 1e-9), 7);
  assert.deepEqual(advanceEnduranceIntervals(state, [], 45), state);
  assert.equal(enduranceIntervalsReadyAt(state, 40, [], 45, 1e-9), null);
  assert.deepEqual(state, { endurance: 20, enduranceUpdatedAt: 2 });
});

test('endurance interval readiness agrees with advancement across partitions, expiry, and spending', () => {
  // Changing observation boundaries must preserve recovery, including affordability exactly at a rate change.
  const state = Object.freeze({ endurance: 0, enduranceUpdatedAt: 0 });
  const vigor = { start: 0, end: 2, rate: 7.5 };
  const base = { start: 2, end: 6, rate: 5 };
  const whole = advanceEnduranceIntervals(state, [vigor, base], 100);
  const partial = advanceEnduranceIntervals(state, [vigor, { ...base, end: 3 }], 100);
  assert.deepEqual(advanceEnduranceIntervals(partial, [{ ...base, start: 3 }], 100), whole);
  assert.deepEqual(whole, { endurance: 35, enduranceUpdatedAt: 6 });
  assert.equal(enduranceIntervalsReadyAt(state, 35, [vigor, base], 100, 1e-9), 6);
  function* early() {
    yield vigor;
    assert.fail('Readiness consumed an interval after the cost was funded');
  }

  assert.equal(enduranceIntervalsReadyAt(state, 15, early(), 100, 1e-9), 2);
  const spent = spendEndurance(advanceEnduranceIntervals(state, [vigor], 100), 10, 2, 100);
  assert.equal(enduranceIntervalsReadyAt(spent, 15, [base], 100, 1e-9), 4);
  assert.equal(advanceEnduranceIntervals(spent, [{ ...base, end: 4 }], 100).endurance, 15);
});

test('endurance interval readiness respects caps and epsilon without predicting impossible recovery', () => {
  // A cap is an affordability limit, not merely a clamp applied after an unbounded prediction.
  const state = { endurance: 40, enduranceUpdatedAt: 0 };
  const intervals = [{ start: 0, end: Infinity, rate: 5 }];
  const unreadable = new Proxy([], { get: () => assert.fail('Impossible costs must not consume intervals') });
  assert.equal(enduranceIntervalsReadyAt(state, 51, unreadable, 50, 0.0001), null);
  assert.equal(enduranceIntervalsReadyAt(state, 50, intervals, 50, 0.0001), 2);
  assert.equal(enduranceIntervalsReadyAt(state, 50, [{ start: 0, end: 1, rate: 5 }], 50, 0.0001), null);
  const capped = advanceEnduranceIntervals(state, intervals, 50);
  assert.deepEqual(capped, { endurance: 50, enduranceUpdatedAt: Infinity });
  assert.equal(enduranceIntervalsReadyAt({ ...state, endurance: 49.99995 }, 50, intervals, 50, 0.0001), 0);
});

test('zero and negative endurance rates stay idle, including infinite windows', () => {
  // Prediction and advancement share the nonnegative recovery rule and never multiply zero by Infinity.
  const state = { endurance: 20, enduranceUpdatedAt: 0 };
  for (const rate of [0, -5]) {
    const idle = { start: 0, end: 2, rate };
    const recovery = { start: 2, end: Infinity, rate: 5 };
    assert.equal(enduranceIntervalsReadyAt(state, 30, [idle, recovery], 100, 1e-9), 4);
    assert.equal(advanceEnduranceIntervals(state, [idle, { ...recovery, end: 4 }], 100).endurance, 30);
    assert.equal(enduranceIntervalsReadyAt(state, 30, [{ ...idle, end: Infinity }], 100, 1e-9), null);
    assert.deepEqual(advanceEndurance(state, Infinity, rate, 100), { endurance: 20, enduranceUpdatedAt: Infinity });
    assert.deepEqual(advanceEnduranceIntervals(state, [{ ...idle, end: Infinity }], 100), {
      endurance: 20,
      enduranceUpdatedAt: Infinity
    });
  }
});
