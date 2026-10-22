import assert from 'node:assert/strict';
import test from 'node:test';
import { LatestWorkerQueue } from '#browser/game/latest-worker-queue.js';

// Controlled transport and timers exercise scheduling contracts without loading a browser or profession.
function fixture(t, onResult = () => {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const workers = [];
  class ControlledWorker {
    listeners = new Map();
    messages = [];
    constructor() {
      workers.push(this);
    }
    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }
    postMessage(message) {
      this.messages.push(message);
    }
    terminate() {
      this.terminated = true;
    }
    reply() {
      this.listeners.get('message')({ data: { requestId: this.messages.at(-1).requestId } });
    }
  }
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: ControlledWorker });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'Worker', descriptor);
    else delete globalThis.Worker;
  });
  const errors = [];
  const queue = new LatestWorkerQueue({
    debounceMs: 40,
    createWorker: () => new Worker(),
    onResult,
    onError: (_job, error) => errors.push(error)
  });
  t.after(() => queue.cancel());
  return { queue, workers, errors };
}

test('follow-up work preserves its debounce so an edit can reuse the idle worker', (t) => {
  const { queue, workers } = fixture(t, () => queue.schedule({ request: 'charts' }));
  queue.schedule({ request: 'baseline' });
  t.mock.timers.tick(40);
  workers[0].reply();
  assert.equal(queue.inFlight, null);
  assert.equal(queue.pending.request, 'charts');
  t.mock.timers.tick(39);
  assert.equal(workers[0].messages.length, 1);
  queue.cancel();
  queue.schedule({ request: 'edit' });
  t.mock.timers.tick(40);
  assert.equal(workers.length, 1);
  assert.equal(workers[0].terminated, undefined);
  assert.equal(workers[0].messages.at(-1).request, 'edit');
});

test('queued work starts after the active job when its debounce has already elapsed', (t) => {
  const published = [];
  const { queue, workers } = fixture(t, (job) => published.push(job.request));
  queue.schedule({ request: 'old' });
  t.mock.timers.tick(40);
  queue.schedule({ request: 'new' });
  t.mock.timers.tick(40);
  assert.equal(workers[0].messages.length, 1);
  workers[0].reply();
  assert.equal(workers[0].messages.at(-1).request, 'new');
  workers[0].reply();
  assert.deepEqual(published, ['new']);
});

test('discarding queued work keeps the active job publishable on its warm worker', (t) => {
  const published = [];
  const { queue, workers } = fixture(t, (job) => published.push(job.request));
  queue.schedule({ request: 'active' });
  t.mock.timers.tick(40);
  queue.schedule({ request: 'queued' });
  queue.discardQueued();
  t.mock.timers.tick(40);
  workers[0].reply();
  assert.equal(workers[0].messages.length, 1);
  assert.equal(workers[0].terminated, undefined);
  assert.equal(queue.pending, null);
  assert.deepEqual(published, ['active']);
});

test('empty worker errors report a useful message and allow a fresh worker on retry', (t) => {
  const { queue, workers, errors } = fixture(t);
  queue.schedule({ request: 'first' });
  t.mock.timers.tick(40);
  workers[0].listeners.get('error')({ message: '' });
  assert.match(errors[0], /Worker failed to load or run/);
  assert.equal(workers[0].terminated, true);
  queue.schedule({ request: 'retry' });
  t.mock.timers.tick(40);
  assert.equal(workers.length, 2);
  assert.equal(workers[1].messages[0].request, 'retry');
});
