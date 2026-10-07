import assert from 'node:assert/strict';
import test from 'node:test';

import { createSimulationRandom } from '#kernel/core/simulation-random.js';
import { normalizeObservationPolicy, observationEndTime } from '#kernel/execution/observation.js';

test('kernel randomness and observation policies are deterministic without game contracts', () => {
  const first = createSimulationRandom({ mode: 'stochastic', seed: 7 });
  const second = createSimulationRandom({ mode: 'stochastic', seed: 7 });

  assert.deepEqual([first.next('action'), first.next('action')], [second.next('action'), second.next('action')]);
  assert.equal(observationEndTime(normalizeObservationPolicy({ kind: 'tail', durationMs: 500 }), 2), 2.5);
});

// Absolute endpoints use the same microsecond clock as execution, with no allowance for an earlier instant.
test('absolute observation rejects earlier canonical endpoints and preserves equal or later endpoints', () => {
  for (const endTimeMs of [999.8, 999.95, 999.999]) {
    assert.throws(() => observationEndTime(normalizeObservationPolicy({ kind: 'absolute', endTimeMs }), 1), {
      name: 'RangeError',
      message: 'Absolute observation endTimeMs cannot precede rotation end.'
    });
  }

  for (const [endTimeMs, expected] of [
    [999.9996, 1],
    [1000, 1],
    [1000.001, 1.000001],
    [1000.05, 1.00005]
  ]) {
    assert.equal(observationEndTime(normalizeObservationPolicy({ kind: 'absolute', endTimeMs }), 1), expected);
  }

  assert.equal(observationEndTime({ kind: 'absolute', endTimeMs: 600 }, 0.56 + 0.04), 0.6);
});

// All policy results are canonical timestamps; a tail is added to the canonical rotation endpoint once.
test('rotation and tail observation endpoints use canonical timestamps', () => {
  assert.equal(observationEndTime({ kind: 'rotation' }, 0.56 + 0.04), 0.6);
  assert.equal(observationEndTime({ kind: 'tail', durationMs: 0.0004 }, 1.0000004), 1);
  assert.equal(observationEndTime({ kind: 'tail', durationMs: 0.0006 }, 1.0000004), 1.000001);
});
