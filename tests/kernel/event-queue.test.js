import assert from 'node:assert/strict';
import test from 'node:test';
import { compareQueuedEvents, StableEventQueue } from '#kernel/events/queue.js';

// A distinct module URL reproduces queues crossing independently loaded class copies.
test('queues from independently loaded modules retain their enqueue and dequeue contract', async () => {
  const { StableEventQueue: IndependentQueue } = await import(
    `${import.meta.resolve('#kernel/events/queue.js')}?independent-copy`
  );
  const later = { at: 2 };
  const earlier = { at: 1 };
  const queue = new IndependentQueue([later]);

  assert.equal(queue instanceof StableEventQueue, false);
  assert.equal(queue.enqueue(earlier), earlier);
  assert.equal(queue.dequeue(), earlier);
  assert.equal(queue.dequeue(), later);
  assert.equal(queue.dequeue(), undefined);
});

// Event queues preserve priority and causal insertion order independently of game rules.
test('same-time queued events retain stable insertion order', () => {
  const queue = new StableEventQueue();

  queue.enqueue({ type: 'damage', at: 1, name: 'first' });
  queue.enqueue({ type: 'damage', at: 1, name: 'second' });
  queue.enqueue({
    type: 'damage',
    at: 1,
    priority: -1,
    name: 'priority'
  });

  assert.deepEqual(
    Array.from({ length: queue.length }, () => queue.dequeue().name),
    ['priority', 'first', 'second']
  );
});

test('heap event queues preserve priority and stable insertion order', () => {
  const queue = new StableEventQueue([
    { type: 'damage', at: 2, name: 'later' },
    { type: 'damage', at: 1, name: 'first' },
    { type: 'damage', at: 1, name: 'second' }
  ]);

  queue.enqueue({
    type: 'damage',
    at: 1,
    priority: -1,
    name: 'priority'
  });
  queue.enqueue({ type: 'damage', at: 1, name: 'third' });

  const names = [];

  while (queue.length) names.push(queue.dequeue().name);
  assert.deepEqual(names, ['priority', 'first', 'second', 'third', 'later']);
});

// Heap construction and incremental insertion must agree with the scheduler history comparator.
test('mixed causal tags retain stable ties in bulk and incremental heaps', () => {
  const events = [
    { at: 1, name: 'tagged-3', causalOrder: 3 },
    { at: 1, name: 'untagged-A' },
    { at: 1, name: 'tagged-1', eventOrder: 1 },
    { at: 1, name: 'untagged-B' },
    { at: 1, name: 'tagged-2', causalOrder: 2 }
  ];

  for (const queue of [new StableEventQueue(events), new StableEventQueue()]) {
    if (!queue.length) {
      for (const event of events) queue.enqueue(event);
    }

    queue.enqueue({ at: 1, name: 'tagged-2-tie', causalOrder: 2 });
    queue.enqueue({ at: 1, name: 'invalid-tag', causalOrder: Number.NaN });

    const names = [];
    while (queue.length) names.push(queue.dequeue().name);
    assert.deepEqual(
      names,
      [
        ...events,
        { at: 1, name: 'tagged-2-tie', causalOrder: 2 },
        { at: 1, name: 'invalid-tag', causalOrder: Number.NaN }
      ]
        .sort(compareQueuedEvents)
        .map((event) => event.name)
    );
    assert.deepEqual(names, [
      'tagged-1',
      'tagged-2',
      'tagged-2-tie',
      'tagged-3',
      'untagged-A',
      'untagged-B',
      'invalid-tag'
    ]);
  }
});

test('heap event queues keep derived causal order local to each queue', () => {
  // Consume enough fallback insertions to expose implementations that share
  // an ordering counter across otherwise independent simulations.
  const warmup = new StableEventQueue([{ type: 'damage', at: 0, name: 'warmup', eventOrder: 0 }]);

  warmup.dequeue();
  for (let index = 0; index < 20; index += 1) {
    warmup.enqueue({
      type: 'damage',
      at: 0,
      name: `warmup-derived-${index}`
    });
  }

  const queue = new StableEventQueue([
    { type: 'damage', at: 1, name: 'cause', eventOrder: 10 },
    { type: 'damage', at: 1, name: 'untagged' },
    { type: 'damage', at: 1, name: 'unrelated', eventOrder: 11 }
  ]);

  assert.equal(queue.dequeue().name, 'cause');
  // Explicit causal placement wins over the current cause and the event's emission order.
  queue.enqueue({ at: 1, name: 'explicit', causalOrder: 12, eventOrder: 9 });

  queue.enqueue({
    type: 'damage',
    at: 1,
    name: 'derived'
  });
  assert.equal(queue.dequeue().name, 'derived');

  queue.enqueue({
    type: 'damage',
    at: 1,
    name: 'nested-derived'
  });
  assert.deepEqual(
    [queue.dequeue().name, queue.dequeue().name, queue.dequeue().name],
    ['nested-derived', 'unrelated', 'explicit']
  );
  assert.equal(queue.dequeue().name, 'untagged');
});
