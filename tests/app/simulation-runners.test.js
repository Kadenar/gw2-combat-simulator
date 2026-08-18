import assert from 'node:assert/strict';
import test from 'node:test';

import { ModifierContributionRunner } from '../../js/app/simulation/modifier-contribution-runner.js';
import { RandomDistributionRunner } from '../../js/app/simulation/random-distribution-runner.js';

function runTimersImmediately(t) {
  t.mock.method(globalThis, 'setTimeout', (callback) => {
    callback();
    return 0;
  });
}

test('modifier fallback clears stale state when calculation fails', (t) => {
  runTimersImmediately(t);
  let renderCount = 0;
  const results = {
    contributions: [],
    modifierContributionsStale: false
  };
  const app = {
    build: { rotation: ['Strike'] },
    results,
    adapter: {
      modifierContributionRequest() {
        return { comparisons: [{}] };
      },
      calculateModifierContributions() {
        throw new Error('Contribution calculation failed.');
      },
      renderResults() {
        renderCount += 1;
      }
    },
    randomDistributionRunner: { isRunning: false }
  };
  const runner = new ModifierContributionRunner(app);

  assert.doesNotThrow(() => runner.schedule());
  assert.equal(results.modifierContributionsStale, false);
  assert.equal(renderCount, 1);
});

test('RNG worker errors preserve the ErrorEvent cause', (t) => {
  runTimersImmediately(t);
  const workerDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  t.after(() => {
    if (workerDescriptor) {
      Object.defineProperty(globalThis, 'Worker', workerDescriptor);
    } else {
      delete globalThis.Worker;
    }
  });

  class FailingWorker {
    constructor() {
      this.listeners = new Map();
    }

    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }

    terminate() {}

    postMessage() {
      this.listeners.get('error')?.({
        error: new Error('Worker module failed.'),
        message: ''
      });
    }
  }

  Object.defineProperty(globalThis, 'Worker', {
    configurable: true,
    writable: true,
    value: FailingWorker
  });

  let renderCount = 0;
  const results = {};
  const app = {
    build: { rotation: ['Strike'] },
    results,
    adapter: {
      randomDistributionRequest() {
        return { trials: 1 };
      },
      renderResults() {
        renderCount += 1;
      }
    }
  };
  const runner = new RandomDistributionRunner(app);

  runner.schedule(true);

  assert.equal(results.randomDistributionStale, false);
  assert.equal(results.randomDistributionError, 'Worker module failed.');
  assert.equal(renderCount, 1);
});
