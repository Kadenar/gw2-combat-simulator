import assert from 'node:assert/strict';
import test from 'node:test';

import { createGameWorkerEndpoint, ManagedWorkerBatch } from '#browser/game/worker-harness.js';

test('game worker endpoints route by game and content and serialize errors', async (t) => {
  const selfDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'self');
  t.after(() => {
    if (selfDescriptor) Object.defineProperty(globalThis, 'self', selfDescriptor);
    else delete globalThis.self;
  });
  let listener = null;
  const posted = [];
  const scope = {
    addEventListener(_type, nextListener) {
      listener = nextListener;
    },
    postMessage(message) {
      posted.push(message);
    }
  };
  // Mock the native worker boundary while exercising the same driver loading path as deployed endpoints.
  Object.defineProperty(globalThis, 'self', { configurable: true, value: scope });
  createGameWorkerEndpoint({
    calculate(driver, { request }, postUpdate) {
      assert.ok(driver);

      if (request.fail) throw new Error('Simulation failed.');

      postUpdate({ progress: 0.5 });
      return { output: 'complete' };
    }
  });

  await listener({ data: { requestId: 17, request: { gameId: 'gw2', contentId: 'engineer' } } });
  await listener({ data: { requestId: 18, request: { gameId: 'fake', contentId: 'missing' } } });
  await listener({
    data: { requestId: 20, request: { gameId: 'gw2', contentId: 'engineer', fail: true } }
  });

  assert.deepEqual(posted, [
    { requestId: 17, progress: 0.5 },
    { requestId: 17, output: 'complete' },
    { requestId: 18, error: 'No worker driver for fake/missing.' },
    { requestId: 20, error: 'Simulation failed.' }
  ]);
});

test('managed worker batches terminate completed and failed workers and reject stale responses', (t) => {
  const workerDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  t.after(() => {
    if (workerDescriptor) Object.defineProperty(globalThis, 'Worker', workerDescriptor);
    else delete globalThis.Worker;
  });

  class ControlledWorker {
    constructor() {
      this.listeners = new Map();
      this.terminated = false;
    }

    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }

    postMessage() {}

    terminate() {
      this.terminated = true;
    }

    respond(message) {
      this.listeners.get('message')?.({ data: message });
    }
  }
  Object.defineProperty(globalThis, 'Worker', {
    configurable: true,
    writable: true,
    value: ControlledWorker
  });

  const failures = [];
  const handled = [];
  const batch = new ManagedWorkerBatch();
  batch.begin(1, (error) => failures.push(error));
  const completedWorker = new globalThis.Worker();
  batch.spawn(
    () => completedWorker,
    1,
    {},
    (message, worker) => {
      handled.push(message.value);
      batch.finish(worker);
    }
  );
  const supersededWorker = new globalThis.Worker();
  batch.spawn(
    () => supersededWorker,
    1,
    {},
    () => {
      assert.fail('a superseded response must not run');
    }
  );

  completedWorker.respond({ requestId: 1, value: 'complete' });
  assert.equal(completedWorker.terminated, true);
  assert.deepEqual(handled, ['complete']);

  batch.begin(2, (error) => failures.push(error));
  assert.equal(supersededWorker.terminated, true);
  supersededWorker.respond({ requestId: 1, value: 'stale' });

  const failedWorker = new globalThis.Worker();
  batch.spawn(
    () => failedWorker,
    2,
    {},
    () => {}
  );
  const peerWorker = new globalThis.Worker();
  batch.spawn(
    () => peerWorker,
    2,
    {},
    () => {}
  );
  failedWorker.respond({ requestId: 2, error: 'Batch failed.' });

  assert.deepEqual(handled, ['complete']);
  assert.deepEqual(failures, ['Batch failed.']);
  assert.equal(failedWorker.terminated, true);
  assert.equal(peerWorker.terminated, true);
  assert.equal(batch.isRunning, false);
  assert.equal(batch.isActive(2), false);
  batch.spawn(
    () => assert.fail('failed requests cannot create workers'),
    2,
    {},
    () => {}
  );

  // A new request recovers from failure while the previous request remains inactive.
  batch.begin(3, (error) => failures.push(error));
  assert.equal(batch.isActive(2), false);
  assert.equal(batch.isActive(3), true);
});
