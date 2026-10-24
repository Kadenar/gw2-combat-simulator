import assert from 'node:assert/strict';
import test from 'node:test';
import { StableEventQueue } from '#kernel/events/queue.js';
import { createPeriodicTaskState, definePeriodicTask } from '#gw2/platform/simulation/periodic-task.js';

// Use the production queue for cancellation and ordering; each fixture has independent passive state.
function fixture(options = {}) {
  const queue = new StableEventQueue();
  const runtime = {
    time: 0,
    state: createPeriodicTaskState(),
    rewards: [],
    readyAt: 0,
    schedule(name, at, data, owner, priority) {
      queue.enqueue({ name, at, data, owner, priority });
    },
    cancelOwner(owner) {
      queue.cancelWhere((event) => event.owner.id === owner.id && event.owner.generation === owner.generation);
    }
  };
  const loop = definePeriodicTask({
    name: 'test.passive',
    priority: -20,
    background: true,
    state: (context) => context.state,
    nextAt: (context) => context.time + 2,
    run: (context) => {
      if (context.readyAt <= context.time) context.rewards.push(context.time);
    },
    ...options
  });
  const pulse = loop.hooks.tasks['test.passive'];
  function through(at) {
    while (queue.peek()?.at <= at) {
      const event = queue.dequeue();
      runtime.time = event.at;
      pulse(runtime, event.data);
    }

    runtime.time = at;
  }

  return { runtime, queue, loop, pulse, through };
}

test('restarting at the same deadline admits one reward and rejects stale or duplicate work', () => {
  const { runtime, queue, loop, pulse, through } = fixture();
  loop.restart(runtime, 2);
  const stale = queue.peek();
  loop.restart(runtime, 2);
  const current = queue.peek();
  assert.notEqual(current.owner.generation, stale.owner.generation);
  assert.equal(queue.pending().length, 1);
  runtime.time = 2;
  pulse(runtime, stale.data);
  assert.deepEqual(runtime.rewards, []);
  through(2);
  pulse(runtime, current.data);
  assert.deepEqual(runtime.rewards, [2]);
  assert.equal(runtime.state.nextAt, 4);
  assert.equal(queue.pending().length, 1);
});

test('a stopped passive cannot rearm from an obsolete task and can start a new lifetime', () => {
  const { runtime, queue, loop, pulse, through } = fixture();
  loop.restart(runtime, 2);
  const stale = queue.peek();
  loop.stop(runtime);
  runtime.time = 2;
  pulse(runtime, stale.data);
  assert.deepEqual(runtime.rewards, []);
  assert.equal(runtime.state.nextAt, Infinity);
  assert.deepEqual(queue.pending(), []);
  loop.restart(runtime, 4);
  through(4);
  assert.deepEqual(runtime.rewards, [4]);
});

test('suppression can preserve cadence or restart a full interval after readiness', () => {
  for (const restartAfterReady of [false, true]) {
    const { runtime, loop, through } = fixture({
      nextAt: (context) => (restartAfterReady ? Math.max(context.time, context.readyAt) : context.time) + 2
    });
    runtime.readyAt = 5;
    loop.restart(runtime, 2);
    through(2);
    assert.deepEqual(runtime.rewards, []);
    assert.equal(runtime.state.nextAt, restartAfterReady ? 7 : 4);
    through(7);
    assert.deepEqual(runtime.rewards, restartAfterReady ? [7] : [6]);
  }
});

test('a reward-owned restart or stop is not overwritten by ordinary rearming', () => {
  for (const rearmBeforeRun of [false, true])
    for (const stop of [false, true]) {
      let loop;
      const fixtureResult = fixture({
        rearmBeforeRun,
        run: (context) => (stop ? loop.stop(context) : loop.restart(context, 10))
      });
      loop = fixtureResult.loop;
      loop.restart(fixtureResult.runtime, 2);
      fixtureResult.through(2);
      assert.equal(fixtureResult.runtime.state.nextAt, stop ? Infinity : 10);
      assert.equal(fixtureResult.queue.pending().length, stop ? 0 : 1);
    }
});

test('resource rewards can observe their accepted successor before granting without admitting duplicate work', () => {
  const observed = [];
  const { runtime, queue, loop, pulse, through } = fixture({
    rearmBeforeRun: true,
    run(context) {
      // A synchronous resource-readiness query sees queued work, not an unset or already-consumed deadline.
      observed.push([context.state.nextAt, queue.peek().at]);
    }
  });
  loop.restart(runtime, 2);
  const accepted = queue.peek();
  through(2);
  pulse(runtime, accepted.data);
  assert.deepEqual(observed, [[4, 4]]);
  assert.equal(queue.pending().length, 1);
});

test('cancellation scans are reserved for replacing or stopping a pending occurrence', () => {
  for (const rearmBeforeRun of [false, true]) {
    const { runtime, queue, loop, through } = fixture({ rearmBeforeRun });
    const cancelled = [];
    const cancelOwner = runtime.cancelOwner;
    runtime.cancelOwner = (owner) => {
      cancelled.push(owner);
      cancelOwner(owner);
    };

    loop.stop(runtime);
    loop.restart(runtime, 2);
    through(4);
    assert.deepEqual(cancelled, [], 'initial admission and claimed occurrences require no scan');

    const replaced = queue.peek().owner;
    loop.restart(runtime, 8);
    const stopped = queue.peek().owner;
    loop.stop(runtime);
    loop.stop(runtime);
    assert.deepEqual(cancelled, [replaced, stopped]);
    assert.deepEqual(queue.pending(), []);
  }
});

test('periodic restart validates deadlines before cancelling accepted work', () => {
  const { runtime, queue, loop } = fixture();
  loop.restart(runtime, 2);
  const accepted = queue.peek();
  for (const at of [NaN, -Infinity, -1]) {
    assert.throws(() => loop.restart(runtime, at), RangeError);
    assert.equal(queue.peek(), accepted);
  }
});

test('periodic task instances keep independent state and classify their registered work as ambient', () => {
  const first = fixture();
  const second = fixture();
  first.loop.restart(first.runtime, 2);
  second.loop.restart(second.runtime, 3);
  first.loop.stop(first.runtime);
  second.through(3);
  assert.deepEqual(second.runtime.rewards, [3]);
  assert.deepEqual(first.runtime.rewards, []);
  assert.ok(second.loop.hooks.backgroundTasks.includes(second.queue.peek().name));
});
