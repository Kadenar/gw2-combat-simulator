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
