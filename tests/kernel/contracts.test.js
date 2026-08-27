import assert from 'node:assert/strict';
import test from 'node:test';

import { createSimulationRandom } from '../../js/kernel/core/simulation-random.js';
import { createEventQueue } from '../../js/kernel/events/queue.js';
import { createEventStream } from '../../js/kernel/events/stream.js';
import { normalizeObservationPolicy, observationEndTime } from '../../js/kernel/execution/observation.js';

test('kernel event streams keep caller identity and queue equal-time events stably', () => {
  const events = [
    { kind: 'fake.action', payload: { id: 1 }, at: 10, priority: 1 },
    { kind: 'fake.action', payload: { id: 2 }, at: 10, priority: 1 },
    { kind: 'fake.action', payload: { id: 3 }, at: 5 }
  ];
  const stream = createEventStream('fake.events', 2, events);
  const queue = createEventQueue(stream.events);

  assert.equal(stream.kind, 'fake.events');
  assert.equal(stream.version, 2);
  assert.deepEqual([queue.dequeue().payload.id, queue.dequeue().payload.id, queue.dequeue().payload.id], [3, 1, 2]);
});

test('kernel randomness and observation policies are deterministic without game contracts', () => {
  const first = createSimulationRandom({ mode: 'stochastic', seed: 7 });
  const second = createSimulationRandom({ mode: 'stochastic', seed: 7 });

  assert.deepEqual([first.next('action'), first.next('action')], [second.next('action'), second.next('action')]);
  assert.equal(observationEndTime(normalizeObservationPolicy({ kind: 'tail', durationMs: 500 }), 2), 2.5);
});
