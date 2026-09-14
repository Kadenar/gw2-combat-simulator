import assert from 'node:assert/strict';
import test from 'node:test';
import { compareQueuedEvents, StableEventQueue } from '#kernel/events/queue.js';
import { canonicalTime, timeKey } from '#kernel/core/clock.js';

// Resolver owners supply phases without putting game event names or author-controlled phase fields in the kernel.
test('private phases outrank priority and prevent backward time, phase rewinds and unbounded chains', () => {
  const phaseFor = (event) => (event.type === 'early' ? 0 : 1);
  const queue = new StableEventQueue(
    [
      { at: 1, type: 'late', priority: -100, phase: -999 },
      { at: 0.96 + 0.04, type: 'early' }
    ],
    { phaseFor, safetyLimit: 3 }
  );
  assert.equal(queue.dequeue().type, 'early');
  assert.equal(queue.currentPhase, 0);
  assert.equal(queue.dequeue().type, 'late');
  assert.throws(() => queue.enqueue({ at: 1, type: 'early', sourceId: 'rewind' }), /past time or phase.*rewind/);
  assert.throws(() => queue.enqueue({ at: 0.999999, type: 'late', sourceId: 'past' }), /past time or phase.*past/);
  queue.enqueue({ at: 1, type: 'late' });
  queue.dequeue();
  queue.enqueue({ at: 1, type: 'late', sourceId: 'loop' });
  assert.throws(() => queue.dequeue(), /safety limit.*1s.*loop/);
  const future = new StableEventQueue([{ at: 1, type: 'late' }], { phaseFor });
  future.dequeue();
  future.enqueue({ at: 1.000001, type: 'early' });
  assert.equal(future.dequeue().type, 'early');
});

// Floating arithmetic must share one instant without merging adjacent microseconds or mutating frozen events.
test('canonical queue time is transitive in bulk, incremental and derived ordering', () => {
  const events = Object.freeze([
    Object.freeze({ at: 0.56 + 0.04, name: 'first', priority: -1 }),
    Object.freeze({ at: 0.6, name: 'second' }),
    Object.freeze({ at: 0.600001, name: 'third', priority: -10 })
  ]);
  for (const queue of [new StableEventQueue(events), new StableEventQueue()]) {
    if (!queue.length) events.forEach((event) => queue.enqueue(event));
    assert.deepEqual(queue.dequeue(), { at: 0.6, name: 'first', priority: -1 });
    const derived = queue.enqueue({ at: 0.56 + 0.04, name: 'derived', priority: -1 });
    assert.equal(derived.at, 0.6);
    assert.equal(queue.dequeue(), derived);
    assert.equal(queue.dequeue().name, 'second');
    assert.equal(queue.dequeue().name, 'third');
  }

  assert.equal(events[0].at, 0.56 + 0.04);
  assert.deepEqual(
    [...events]
      .reverse()
      .sort(compareQueuedEvents)
      .map((event) => event.name),
    ['first', 'second', 'third']
  );
  assert.equal(timeKey(0.56 + 0.04), 600000);
  assert.equal(canonicalTime(-0.0000001), 0);
  for (const at of [Infinity, -Infinity, NaN, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => new StableEventQueue([{ at }]), /microseconds/);
    assert.throws(() => new StableEventQueue().enqueue({ at }), /microseconds/);
  }
});

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
