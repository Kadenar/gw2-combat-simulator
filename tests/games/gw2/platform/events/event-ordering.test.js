import assert from 'node:assert/strict';
import test from 'node:test';

import { GW2_RESOLVER_PHASE, gw2ResolverPhase } from '#gw2/platform/resolver/event-phase.js';
import { eventCausalOrder, StableEventQueue } from '#kernel/events/queue.js';

// Buff grants cannot bypass condition settlement or rewind a hit that created them.
test('buff command boundaries preserve settlement and causal hit reactions', () => {
  const queue = new StableEventQueue({ phaseFor: gw2ResolverPhase });
  queue.enqueue({ type: 'condition_tick', at: 1 });
  queue.enqueue({ type: 'damage', at: 1 });
  assert.throws(() => queue.advanceFrontier(1, GW2_RESOLVER_PHASE.Buffs), /pending work/);
  assert.equal(queue.dequeue().type, 'condition_tick');
  queue.advanceFrontier(1, GW2_RESOLVER_PHASE.Buffs);
  queue.enqueue({ type: 'buff', at: 1 });
  assert.throws(() => queue.advanceFrontier(1, GW2_RESOLVER_PHASE.Buffs), /pending work/);
  assert.equal(queue.dequeue().type, 'buff');
  assert.equal(queue.currentPhase, GW2_RESOLVER_PHASE.Buffs);
  assert.equal(queue.dequeue().type, 'damage');
  assert.throws(() => queue.advanceFrontier(1, GW2_RESOLVER_PHASE.Buffs), /past time or phase/);
  queue.enqueue({ type: 'buff', at: 1 });
  assert.equal(queue.dequeue().type, 'buff');
  assert.equal(queue.currentPhase, GW2_RESOLVER_PHASE.Ordinary);
});

test('scheduled buffs and boon extensions precede tied damage regardless of insertion order and priority', () => {
  for (const type of ['buff', 'boon_extension']) {
    for (const reverse of [false, true]) {
      const queue = new StableEventQueue({ phaseFor: gw2ResolverPhase });
      const events = [
        { type: 'damage', at: 1, priority: -100 },
        { type, at: 1, priority: 100 }
      ];
      for (const event of reverse ? events.reverse() : events) queue.enqueue(event);
      assert.equal(queue.dequeue().type, type);
      assert.equal(queue.dequeue().type, 'damage');
    }
  }
});

test('buff-phase callbacks do not promote conditions or arbitrary tasks', () => {
  for (const type of ['condition', 'runtime.task', 'runtime.complete']) {
    const queue = new StableEventQueue({ phaseFor: gw2ResolverPhase });
    queue.enqueue({ type: 'buff', at: 1 });
    queue.dequeue();
    queue.enqueue({ type, at: 1 });
    queue.dequeue();
    assert.equal(queue.currentPhase, GW2_RESOLVER_PHASE.Ordinary);
  }
});

test('a command may precede lower-priority work without bypassing earlier lifecycle work', () => {
  const queue = new StableEventQueue({ phaseFor: gw2ResolverPhase });
  queue.enqueue({ type: 'runtime.complete', at: 1, priority: -100 });
  queue.enqueue({ type: 'damage', at: 1 });
  assert.throws(() => queue.advanceFrontier(1, GW2_RESOLVER_PHASE.Ordinary, 'grant', -1), /pending work/);
  assert.equal(queue.dequeue().type, 'runtime.complete');
  queue.advanceFrontier(1, GW2_RESOLVER_PHASE.Ordinary, 'grant', -1);
  queue.enqueue({ type: 'buff', at: 1, priority: -1 });
  assert.equal(queue.dequeue().type, 'buff');
  assert.equal(queue.dequeue().type, 'damage');
});

// Phase 1 contract for the future cursor: settle due hits, then drain each command's effects before the next command.
test('command boundaries see settled conditions and hit gains before same-time self transitions', () => {
  const queue = new StableEventQueue({ phaseFor: gw2ResolverPhase });
  queue.enqueue({ type: 'damage', at: 1, eventOrder: 3 });
  queue.enqueue({ type: 'condition_tick', at: 1, eventOrder: 2 });
  queue.enqueue({ type: 'condition_buffer', at: 1, eventOrder: 1 });
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
  const queue = new StableEventQueue();
  for (const event of events) queue.enqueue(event);
  const ordered = [];
  while (queue.peek()) ordered.push(queue.dequeue().name);

  assert.deepEqual(ordered, ['priority-first', 'causal-first', 'causal-second', 'stable-first', 'later']);
});
