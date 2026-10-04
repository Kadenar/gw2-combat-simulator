import assert from 'node:assert/strict';
import test from 'node:test';
import { SkillDamageRunner } from '#gw2/app/simulation/skill-damage/runner.js';

/** Controlled transport verifies request ordering without running another simulation or browser. */
function setup(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
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
    reply(message) {
      this.listeners.get('message')({ data: message });
    }
  }
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: ControlledWorker });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'Worker', previous);
    else delete globalThis.Worker;
  });
  const published = [];
  const runner = new SkillDamageRunner((...args) => published.push(args));
  t.after(() => runner.cancel());
  const plan = (signature) => ({ signature, request: { config: {}, occurrences: [] } });
  return { workers, published, runner, plan };
}

test('damage preview coalesces edits and publishes only the latest worker response', (t) => {
  const { workers, published, runner, plan } = setup(t);
  runner.schedule(plan('old'));
  t.mock.timers.tick(150);
  const worker = workers[0];
  runner.schedule(plan('intermediate'));
  runner.schedule(plan('latest'));
  worker.reply({ requestId: worker.messages[0].requestId, evaluation: { occurrences: [] } });
  assert.equal(published.length, 0);
  assert.equal(worker.messages.length, 2);
  worker.reply({ requestId: worker.messages[1].requestId, evaluation: { occurrences: [] } });
  assert.equal(published.length, 1);
  assert.equal(published[0][0], 'latest');
  assert.equal(runner.isRunning, false);
});

test('closing the preview terminates in-flight work and ignores its late response', (t) => {
  const { workers, published, runner, plan } = setup(t);
  runner.schedule(plan('closed'));
  t.mock.timers.tick(150);
  const worker = workers[0];
  runner.cancel();
  worker.reply({ requestId: worker.messages[0].requestId, evaluation: { occurrences: [] } });
  assert.equal(worker.terminated, true);
  assert.equal(published.length, 0);
  assert.equal(runner.isRunning, false);
  runner.schedule(plan('reopened'));
  t.mock.timers.tick(150);
  assert.equal(workers.length, 2);
});

test('worker errors publish once and a later request can recover', (t) => {
  const { workers, published, runner, plan } = setup(t);
  runner.schedule(plan('failed'));
  t.mock.timers.tick(150);
  workers[0].listeners.get('error')({ message: 'Calculation failed' });
  assert.equal(published[0][2], 'Calculation failed');
  assert.equal(runner.isRunning, false);
  runner.schedule(plan('retry'));
  t.mock.timers.tick(150);
  const worker = workers[1];
  worker.reply({ requestId: worker.messages[0].requestId, evaluation: { occurrences: [] } });
  assert.equal(published[1][0], 'retry');
  assert.equal(published[1][2], '');
});
