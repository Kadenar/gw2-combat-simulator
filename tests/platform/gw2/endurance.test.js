import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceEndurance,
  enduranceReadyAt,
  grantEndurance,
  spendEndurance
} from '../../../js/platform/gw2/combat/resources/endurance.js';

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
