import assert from 'node:assert/strict';
import test from 'node:test';

import { createSimulationRandom } from '#kernel/core/simulation-random.js';
import { StableEventQueue } from '#kernel/events/queue.js';
import { normalizeObservationPolicy, observationEndTime } from '#kernel/execution/observation.js';

test('kernel queue preserves equal-time insertion order', () => {
  const events = [
    { kind: 'fake.action', payload: { id: 1 }, at: 10, priority: 1 },
    { kind: 'fake.action', payload: { id: 2 }, at: 10, priority: 1 },
    { kind: 'fake.action', payload: { id: 3 }, at: 5 }
  ];

  const queue = new StableEventQueue(events);

  assert.deepEqual([queue.dequeue().payload.id, queue.dequeue().payload.id, queue.dequeue().payload.id], [3, 1, 2]);
});

test('kernel randomness and observation policies are deterministic without game contracts', () => {
  const first = createSimulationRandom({ mode: 'stochastic', seed: 7 });
  const second = createSimulationRandom({ mode: 'stochastic', seed: 7 });

  assert.deepEqual([first.next('action'), first.next('action')], [second.next('action'), second.next('action')]);
  assert.equal(observationEndTime(normalizeObservationPolicy({ kind: 'tail', durationMs: 500 }), 2), 2.5);
});
