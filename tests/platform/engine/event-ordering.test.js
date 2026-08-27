import assert from 'node:assert/strict';
import test from 'node:test';

import { compareQueuedEvents, StableEventQueue } from '../../../js/kernel/events/queue.js';
import { eventCausalOrder, eventTimestamp } from '../../../js/games/gw2/platform/engine/events/events.js';

test('event ordering primitives preserve canonical and legacy field precedence', () => {
  assert.equal(eventTimestamp({ at: 3, time: 4 }), 3);
  assert.equal(eventTimestamp({ time: 4 }), 4);
  assert.equal(eventTimestamp({}), 0);
  assert.equal(eventCausalOrder({ causalOrder: 2, __order: 3 }), 2);
  assert.equal(eventCausalOrder({ __order: 3 }), 3);
  assert.equal(eventCausalOrder({ causalOrder: Number.NaN }), null);
});

test('event queues retain timestamp, priority, causal, and stable insertion ordering', () => {
  const events = [
    { name: 'stable-first', at: 1, priority: 0 },
    { name: 'causal-second', at: 1, priority: 0, causalOrder: 2 },
    { name: 'causal-first', at: 1, priority: 0, causalOrder: 1 },
    { name: 'priority-first', at: 1, priority: -1 },
    { name: 'later', at: 2, priority: -10 }
  ];
  const queue = new StableEventQueue(events);
  const ordered = [];
  while (queue.length) ordered.push(queue.dequeue().name);

  assert.deepEqual(ordered, ['priority-first', 'stable-first', 'causal-first', 'causal-second', 'later']);
  assert.ok(compareQueuedEvents({ time: 1 }, { at: 2 }) < 0);
});
