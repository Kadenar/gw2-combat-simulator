import assert from 'node:assert/strict';
import test from 'node:test';
import { createEventQueue, enqueueOrdered, takeNextEvent } from '#kernel/events/queue.js';

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
});
