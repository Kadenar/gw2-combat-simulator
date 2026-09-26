import assert from 'node:assert/strict';
import test from 'node:test';
import { compareQueuedEvents, StableEventQueue } from '#kernel/events/queue.js';
import { canonicalTime, timeKey } from '#kernel/core/clock.js';

// Peeking may discard canceled work, but must never advance time or consume the inclusive boundary.
test('live peeking skips canceled entries and leaves endpoint descendants available', () => {
  const queue = new StableEventQueue();
  const canceled = queue.enqueue({ at: 0.5 });
  queue.enqueue({ at: 1, name: 'boundary' });
  queue.enqueue({ at: 1.000001, name: 'outside' });
  queue.cancel(canceled);
  assert.equal(queue.peek().name, 'boundary');
  assert.equal(queue.currentTime, null);
  assert.equal(queue.dequeue().name, 'boundary');
  queue.enqueue({ at: 1, name: 'child' });
  assert.equal(queue.peek().name, 'child');
  assert.equal(queue.dequeue().name, 'child');
  assert.equal(queue.peek().at, 1.000001);
  assert.equal(queue.currentTime, 1);
  queue.cancel(queue.peek());
  assert.equal(queue.peek(), undefined);
  assert.equal(queue.dequeue(), undefined);
  assert.equal(queue.length, 0);
});

// Cancellation belongs to the chosen lifetime, not every packet attributed to the originating activation.
test('renewed owners and committed projectiles survive cancellation of an old lifetime', () => {
  const queue = new StableEventQueue();
  const old = queue.enqueue({ at: 1, owner: 'pet:1', activationId: 'cast:1' });
  const projectile = queue.enqueue({ at: 2, owner: 'projectile:1', activationId: 'cast:1' });
  queue.cancelWhere((event) => event.owner === 'pet:1');
  const renewed = queue.enqueue({ at: 1, owner: 'pet:2', activationId: 'cast:2' });
  assert.equal(queue.dequeue(), renewed);
  assert.equal(queue.dequeue(), projectile);
  assert.equal(queue.peek(), undefined);
  // Even reusing an input cannot reactivate its retired insertion.
  queue.enqueue({ ...old, at: 3 });
  assert.equal(queue.dequeue().at, 3);
  assert.equal(queue.peek(), undefined);
});

// A command with no preceding event still closes earlier phases and clears the previous cause.
test('command frontiers canonicalize time, reject rewinds, and start independent causal roots', () => {
  const queue = new StableEventQueue([], { phaseFor: (event) => (event.type === 'sample' ? 0 : 2) });
  queue.advanceFrontier(0.56 + 0.04, 2);
  assert.equal(queue.currentTime, 0.6);
  assert.throws(() => queue.enqueue({ at: 0.599999 }), /past time or phase/);
  assert.throws(() => queue.enqueue({ at: 0.6, type: 'sample' }), /past time or phase/);
  assert.throws(() => queue.advanceFrontier(0.6, 0), /past time or phase/);
  queue.enqueue({ at: 0.6, eventOrder: 10 });
  queue.dequeue();
  assert.equal(queue.currentCausalOrder, 10);
  queue.advanceFrontier(0.6, 2);
  assert.equal(queue.currentCausalOrder, null);
  queue.enqueue({ at: 0.6, name: 'new-root-child' });
  queue.enqueue({ at: 0.6, eventOrder: 11, name: 'explicit-root' });
  assert.equal(queue.dequeue().name, 'explicit-root');
  assert.equal(queue.dequeue().name, 'new-root-child');
  queue.enqueue({ at: 0.7, type: 'sample' });
  assert.throws(() => queue.advanceFrontier(0.7, 2), /pending work/);
  assert.equal(queue.dequeue().type, 'sample');
});

// Neither commands nor events can reset the other's same-time safety budget, including phase-free consumers.
test('alternating commands and events share one same-time safety limit', () => {
  const queue = new StableEventQueue([], { safetyLimit: 3 });
  queue.advanceFrontier(1);
  queue.enqueue({ at: 1 });
  queue.dequeue();
  queue.advanceFrontier(1);
  queue.enqueue({ at: 1, sourceId: 'alternating-loop' });
  assert.throws(() => queue.dequeue(), /safety limit.*alternating-loop/);
  const commands = new StableEventQueue([], { safetyLimit: 1 });
  commands.advanceFrontier(0);
  commands.advanceFrontier(1);
  assert.throws(() => commands.advanceFrontier(1), /safety limit/);
  for (const safetyLimit of [0, -1, 1.5, Infinity, NaN]) {
    assert.throws(() => new StableEventQueue([], { safetyLimit }), /positive safe integer/);
  }
});

// Captured keys keep the heap stable; malformed edits fail instead of silently changing execution order.
test('pending ordering keys require cancel-and-enqueue replacement', () => {
  for (const [field, value] of [
    ['at', 0],
    ['priority', -10],
    ['causalOrder', 0],
    ['eventOrder', 0]
  ]) {
    const event = { at: 2, priority: 0 };
    const queue = new StableEventQueue([{ at: 1 }, event]);
    event[field] = value;
    assert.throws(() => {
      while (queue.peek()) queue.dequeue();
    }, /ordering keys changed/);
    queue.cancel(event);
    queue.enqueue({ at: 3, priority: -10 });
    while (queue.peek()) queue.dequeue();
  }

  for (const priority of [NaN, Infinity, -Infinity]) {
    assert.throws(() => new StableEventQueue([{ at: 0, priority }]), /priority must be finite/);
  }
});

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
