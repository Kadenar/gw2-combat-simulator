import assert from 'node:assert/strict';
import test from 'node:test';

import { ModifierContributionRunner } from '../../js/app/simulation/modifier-contribution-runner.js';
import { RandomDistributionRunner } from '../../js/app/simulation/random-distribution-runner.js';
import { RelicComparisonRunner } from '../../js/app/simulation/relic-comparison-runner.js';

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

function minimalResult(damageAt1s) {
  // buildChartSeries only needs the DPS window, resolved damage events, and
  // (optionally) breakdown/events — keep it minimal but non-empty.
  return {
    dpsStartTime: 0,
    dpsWindow: 4,
    duration: 4,
    breakdown: [],
    events: [],
    resolvedEvents: [{ type: 'damage', at: 1, damage: damageAt1s }]
  };
}

test('relic comparison scheduling publishes availability without simulating', () => {
  const results = minimalResult(4000);
  let simulated = 0;
  const app = {
    build: { rotation: ['Strike'], relic: 'Fractal' },
    results,
    adapter: {
      relicComparisonRequest() {
        return {
          professionId: 'engineer',
          rotation: ['Strike'],
          baseConfig: { relic: 'Fractal' },
          opponentRelic: 'Fractal',
          comparisonRelic: 'Thorns'
        };
      },
      simulateBuild() {
        simulated += 1;
        return minimalResult(4000);
      },
      renderResults() {}
    }
  };
  const runner = new RelicComparisonRunner(app);
  runner.schedule();
  assert.equal(results.relicComparisonAvailable, true);
  assert.equal(results.relicComparisonOpponent, 'Fractal');
  assert.equal(simulated, 0, 'scheduling must not run the second simulation');
});

test('relic comparison run simulates Thorns once and stores the break-even model', (t) => {
  runTimersImmediately(t);
  let renderCount = 0;
  const simulatedRelics = [];
  const results = minimalResult(4000);
  const app = {
    build: { rotation: ['Strike'], relic: 'Fractal' },
    results,
    adapter: {
      relicComparisonRequest() {
        return {
          professionId: 'engineer',
          rotation: ['Strike'],
          baseConfig: { relic: 'Fractal' },
          opponentRelic: 'Fractal',
          comparisonRelic: 'Thorns'
        };
      },
      simulateBuild(_rotation, config) {
        simulatedRelics.push(config.relic);
        return minimalResult(4200);
      },
      renderResults() {
        renderCount += 1;
      }
    }
  };
  const runner = new RelicComparisonRunner(app);
  runner.run();

  assert.deepEqual(simulatedRelics, ['Thorns'], 'exactly one Thorns simulation runs');
  assert.equal(results.relicComparisonStale, false);
  assert.equal(results.relicComparisonError, '');
  assert.ok(results.relicComparison, 'break-even model is stored');
  assert.equal(results.relicComparison.opponentRelic, 'Fractal');
  assert.equal(results.relicComparison.targetRelic, 'Thorns');
  assert.ok(renderCount >= 1);
});

test('relic comparison run surfaces simulation failures', (t) => {
  runTimersImmediately(t);
  const results = minimalResult(4000);
  const app = {
    build: { rotation: ['Strike'], relic: 'Akeem' },
    results,
    adapter: {
      relicComparisonRequest() {
        return {
          professionId: 'engineer',
          rotation: ['Strike'],
          baseConfig: { relic: 'Akeem' },
          opponentRelic: 'Akeem',
          comparisonRelic: 'Thorns'
        };
      },
      simulateBuild() {
        throw new Error('Comparison simulation failed.');
      },
      renderResults() {}
    }
  };
  const runner = new RelicComparisonRunner(app);
  runner.run();

  assert.equal(results.relicComparisonStale, false);
  assert.equal(results.relicComparisonError, 'Comparison simulation failed.');
});
