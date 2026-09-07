import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEventQueue,
  enqueueOrdered,
  sortQueuedEvents,
  StableEventQueue,
  takeNextEvent
} from '#kernel/events/queue.js';

// A distinct module URL reproduces queues crossing independently loaded class copies.
test('queue helpers accept a queue from an independently loaded module', async () => {
  const { createEventQueue: createIndependentQueue } = await import(
    `${import.meta.resolve('#kernel/events/queue.js')}?independent-copy`
  );
  const later = { at: 2 };
  const earlier = { at: 1 };
  const queue = createIndependentQueue([later]);

  assert.equal(queue instanceof StableEventQueue, false);
  assert.equal(enqueueOrdered(queue, earlier), earlier);
  assert.equal(createEventQueue(queue), queue);
  assert.equal(sortQueuedEvents(queue), queue);
  assert.equal(takeNextEvent(queue), earlier);
  assert.equal(takeNextEvent(queue), later);
  assert.equal(takeNextEvent(queue), undefined);
});

// Event queues preserve priority and causal insertion order independently of game rules.
test('same-time queued events retain stable insertion order', () => {
  const queue = [];

  enqueueOrdered(queue, { type: 'damage', at: 1, name: 'first' });
  enqueueOrdered(queue, { type: 'damage', at: 1, name: 'second' });
  enqueueOrdered(queue, {
    type: 'damage',
    at: 1,
    priority: -1,
    name: 'priority'
  });

  assert.deepEqual(
    queue.map((event) => event.name),
    ['priority', 'first', 'second']
  );
});

test('heap event queues preserve priority and stable insertion order', () => {
  const queue = createEventQueue([
    { type: 'damage', at: 2, name: 'later' },
    { type: 'damage', at: 1, name: 'first' },
    { type: 'damage', at: 1, name: 'second' }
  ]);

  enqueueOrdered(queue, {
    type: 'damage',
    at: 1,
    priority: -1,
    name: 'priority'
  });
  enqueueOrdered(queue, { type: 'damage', at: 1, name: 'third' });

  const names = [];

  while (queue.length) names.push(takeNextEvent(queue).name);
  assert.deepEqual(names, ['priority', 'first', 'second', 'third', 'later']);
});

// Mixed metadata must use the same total order for bulk sorting and incremental insertion.
test('mixed causal tags sort before untagged events with stable ties in arrays and heaps', () => {
  const events = [
    { at: 1, name: 'tagged-3', causalOrder: 3 },
    { at: 1, name: 'untagged-A' },
    { at: 1, name: 'tagged-1', eventOrder: 1 },
    { at: 1, name: 'untagged-B' },
    { at: 1, name: 'tagged-2', causalOrder: 2 }
  ];

  for (const queue of [sortQueuedEvents([...events]), createEventQueue(events), [], createEventQueue()]) {
    if (!queue.length) {
      for (const event of events) enqueueOrdered(queue, event);
    }

    enqueueOrdered(queue, { at: 1, name: 'tagged-2-tie', causalOrder: 2 });
    enqueueOrdered(queue, { at: 1, name: 'invalid-tag', causalOrder: Number.NaN });

    const names = [];
    while (queue.length) names.push(takeNextEvent(queue).name);
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
  const warmup = createEventQueue([{ type: 'damage', at: 0, name: 'warmup', eventOrder: 0 }]);

  takeNextEvent(warmup);
  for (let index = 0; index < 20; index += 1) {
    enqueueOrdered(warmup, {
      type: 'damage',
      at: 0,
      name: `warmup-derived-${index}`
    });
  }

  const queue = createEventQueue([
    { type: 'damage', at: 1, name: 'cause', eventOrder: 10 },
    { type: 'damage', at: 1, name: 'untagged' },
    { type: 'damage', at: 1, name: 'unrelated', eventOrder: 11 }
  ]);

  assert.equal(takeNextEvent(queue).name, 'cause');

  enqueueOrdered(queue, {
    type: 'damage',
    at: 1,
    name: 'derived'
  });
  assert.equal(takeNextEvent(queue).name, 'derived');

  enqueueOrdered(queue, {
    type: 'damage',
    at: 1,
    name: 'nested-derived'
  });
  assert.deepEqual([takeNextEvent(queue).name, takeNextEvent(queue).name], ['nested-derived', 'unrelated']);
  assert.equal(takeNextEvent(queue).name, 'untagged');
});
