import assert from 'node:assert/strict';
import test from 'node:test';

import { createGameWorkerEndpoint } from '#browser/game/worker-endpoint.js';

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
