import assert from 'node:assert/strict';
import test from 'node:test';

import { compareQueuedEvents, eventCausalOrder, StableEventQueue } from '#kernel/events/queue.js';
import { gw2ResolverPhase, GW2_RESOLVER_PHASE } from '#gw2/platform/resolver/event-loop.js';

// Phase 1 contract for the future cursor: settle due hits, then drain each command's effects before the next command.
test('command boundaries see settled conditions and hit gains before same-time self transitions', () => {
  const queue = new StableEventQueue(
    [
      { type: 'damage', at: 1, eventOrder: 3 },
      { type: 'condition_tick', at: 1, eventOrder: 2 },
      { type: 'condition_buffer', at: 1, eventOrder: 1 }
    ],
    { phaseFor: gw2ResolverPhase }
  );
  const trace = [];
  let resource = 0;
  assert.throws(() => queue.advanceFrontier(1, GW2_RESOLVER_PHASE.Ordinary), /pending work/);
  while (queue.peek()?.at === 1) {
    const event = queue.dequeue();
    trace.push(event.type);
    if (event.type === 'damage') resource++;
  }

  queue.advanceFrontier(1, GW2_RESOLVER_PHASE.Ordinary);
  assert.equal(resource, 1);
  queue.enqueue({ type: 'form', at: 1 });
  assert.throws(() => queue.advanceFrontier(1, GW2_RESOLVER_PHASE.Ordinary), /pending work/);
  const form = queue.dequeue().type === 'form';
  queue.advanceFrontier(1, GW2_RESOLVER_PHASE.Ordinary);
  assert.equal(form, true);
  assert.deepEqual(trace, ['condition_buffer', 'condition_tick', 'damage']);
  assert.throws(() => queue.enqueue({ type: 'condition_buffer', at: 1 }), /past time or phase/);
});

test('event ordering prefers explicit causal placement over emission order', () => {
  assert.equal(eventCausalOrder({ causalOrder: 2, eventOrder: 3 }), 2);
  assert.equal(eventCausalOrder({ eventOrder: 3 }), 3);
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

  assert.deepEqual(ordered, ['priority-first', 'causal-first', 'causal-second', 'stable-first', 'later']);
  assert.ok(compareQueuedEvents({ time: 1 }, { at: 2 }) < 0);
});
