import assert from 'node:assert/strict';
import test from 'node:test';

import { createGameWorkerEndpoint, ManagedWorkerBatch } from '#app/game/worker-harness.js';

test('game worker endpoints route by game and content and serialize errors', async () => {
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
  createGameWorkerEndpoint({
    scope,
    echo: ({ revision }) => ({ revision }),
    async loadDriver({ contentId }) {
      if (contentId === 'missing') return null;

      if (contentId === 'load-failure') throw new Error('Adapter import failed.');
      return {};
    },
    calculate(_adapter, { request }, postUpdate) {
      if (request.fail) throw new Error('Simulation failed.');

      postUpdate({ progress: 0.5 });
      return { output: 'complete' };
    }
  });

  await listener({ data: { requestId: 17, revision: 4, request: { gameId: 'fake', contentId: 'engineer' } } });
  await listener({ data: { requestId: 18, revision: 5, request: { gameId: 'fake', contentId: 'missing' } } });
  await listener({ data: { requestId: 19, revision: 6, request: { gameId: 'fake', contentId: 'load-failure' } } });
  await listener({
    data: { requestId: 20, revision: 7, request: { gameId: 'fake', contentId: 'engineer', fail: true } }
  });

  assert.deepEqual(posted, [
    { requestId: 17, revision: 4, progress: 0.5 },
    { requestId: 17, revision: 4, output: 'complete' },
    { requestId: 18, revision: 5, error: 'No worker driver for fake/missing.' },
    { requestId: 19, revision: 6, error: 'Adapter import failed.' },
    { requestId: 20, revision: 7, error: 'Simulation failed.' }
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
  const completedWorker = batch.spawn(
    () => new globalThis.Worker(),
    1,
    {},
    (message, worker) => {
      handled.push(message.value);
      batch.finish(worker);
    }
  );
  const supersededWorker = batch.spawn(
    () => new globalThis.Worker(),
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

  const failedWorker = batch.spawn(
    () => new globalThis.Worker(),
    2,
    {},
    () => {}
  );
  const peerWorker = batch.spawn(
    () => new globalThis.Worker(),
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
});
