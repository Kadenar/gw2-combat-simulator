import assert from 'node:assert/strict';
import test from 'node:test';
import { defineAlliedOpportunityTask } from '#gw2/platform/combat/state/allied-opportunities.js';
import { consumeCharge, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { StableEventQueue } from '#kernel/events/queue.js';

// Exercise the shared cursor against the production queue without introducing profession payloads.
function fixture(options = {}) {
  const queue = new StableEventQueue();
  const attempts = [];
  const task = defineAlliedOpportunityTask({
    name: 'fixture.allied-opportunity',
    cadence: 'anchored',
    priority: 0,
    eligibleAt: () => true,
    attempt: (runtime, stream) => attempts.push([runtime.time, stream.data]),
    ...options
  });
  const runtime = {
    time: 0,
    deathTime: null,
    schedule(name, at, data, owner, priority) {
      queue.enqueue({ name, at, data, owner, priority });
    },
    cancelOwner(owner) {
      queue.cancelWhere((event) => event.owner?.id === owner.id && event.owner?.generation === owner.generation);
    }
  };
  return {
    task,
    runtime,
    queue,
    attempts,
    start: (stream = {}) => task.start(runtime, { anchor: runtime.time, interval: 1 / 3, data: null, ...stream }),
    advance(at) {
      while (queue.peek()?.at <= at) {
        const event = queue.dequeue();
        runtime.time = event.at;
        task.tasks[event.name](runtime, event.data);
      }

      runtime.time = at;
    }
  };
}

// Both scheduling modes continue opportunities while keeping only the next wake queued.
test('allied streams continue with one pending wake in both cadence modes', () => {
  for (const cadence of ['anchored', 'stepped']) {
    const run = fixture({ cadence });
    run.start();
    assert.equal(run.queue.pending().length, 1);
    run.advance(1);
    assert.ok(run.attempts.length > 0);
    assert.equal(run.queue.pending().length, 1);
  }
});

// Recipient grants, not the scheduler, own the exclusive ICD boundary and exhaustion.
test('blocked ICD opportunities continue while independently exhausted recipients stop', () => {
  const grants = { first: grantCharges(2, 1), second: grantCharges(1, 1) };
  const spent = [];
  const run = fixture({
    eligibleAt: (_runtime, stream, at) => grants[stream.data].charges > 0 && at < grants[stream.data].expiresAt,
    attempt(runtime, stream) {
      if (consumeCharge(grants[stream.data], runtime.time, 0.3)) spent.push([stream.data, runtime.time]);
    }
  });
  run.start({ interval: 0.1, data: 'first' });
  run.start({ interval: 0.1, data: 'second' });
  run.advance(1);
  assert.deepEqual(spent, [
    ['first', 0.1],
    ['second', 0.1],
    ['first', 0.5]
  ]);
  assert.equal(run.queue.pending().length, 0);
});

// Cancellation removes queued work; checking the canonical generation also rejects an already retained stale wake.
test('replacement cancels its owner and stale generation dispatch cannot consume or continue', () => {
  let generation = 1;
  const run = fixture({ eligibleAt: (_runtime, stream) => stream.owner.generation === generation });
  const oldOwner = { id: 'spell', generation };
  run.start({ owner: oldOwner, interval: 1 });
  const stale = run.queue.peek();
  run.advance(0.5);
  run.runtime.cancelOwner(oldOwner);
  generation++;
  run.start({ owner: { id: 'spell', generation }, interval: 1 });
  run.runtime.time = 1;
  run.task.tasks[stale.name](run.runtime, stale.data);
  assert.equal(run.queue.pending().length, 1);
  run.advance(1.5);
  assert.deepEqual(run.attempts, [[1.5, null]]);
});

// Death terminates pending streams without a final attempt, while expiry remains an owner-selected boundary.
test('exclusive expiry and target death reject opportunities without further wakes', () => {
  const expired = fixture({ eligibleAt: (_runtime, _stream, at) => at < 1 });
  expired.start({ interval: 0.5 });
  expired.advance(1);
  assert.deepEqual(expired.attempts, [[0.5, null]]);
  assert.equal(expired.queue.pending().length, 0);
  const dead = fixture();
  dead.start();
  dead.runtime.deathTime = 0.1;
  dead.advance(1);
  assert.deepEqual(dead.attempts, []);
  assert.equal(dead.queue.pending().length, 0);
});

// Invalid or sub-clock intervals must fail rather than create a non-advancing task loop.
test('allied stream start rejects invalid and non-advancing deadlines', () => {
  for (const interval of [0, -1, Infinity, NaN, 0.0000001]) {
    const run = fixture();
    assert.throws(() => run.start({ interval }), RangeError);
    assert.equal(run.queue.pending().length, 0);
  }
});
