import assert from 'node:assert/strict';
import test from 'node:test';

import { ProfessionApp } from '../../js/app/profession-app.js';
import { ModifierContributionRunner } from '../../js/app/simulation/modifier-contribution-runner.js';
import { BaselineSimulationRunner } from '../../js/app/simulation/baseline-simulation-runner.js';
import { RandomDistributionRunner } from '../../js/app/simulation/random-distribution-runner.js';
import { RelicComparisonRunner } from '../../js/app/simulation/relic-comparison-runner.js';

const STRIKE_ROTATION = [{ type: 'cast', skillId: 'Strike' }];

function runTimersImmediately(t) {
  t.mock.method(globalThis, 'setTimeout', (callback) => {
    callback();

    return 0;
  });
}

test('rotation-only changes paint the builder once with their matching result', (t) => {
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  t.after(() => {
    if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor);
    else delete globalThis.document;
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { body: { dataset: {} } }
  });

  let scheduledRevision = null;
  let renderedResults = [];
  const app = Object.assign(Object.create(ProfessionApp.prototype), {
    initialRenderGeneration: 0,
    deferredRotationRenderRevision: null,
    buildRevision: 2,
    resultRevision: 1,
    simulationStatus: 'idle',
    simulationError: '',
    results: { id: 'old', contributions: [] },
    patchComparison: null,
    templateContainer: null,
    prepareSimulationState: () => 2,
    baselineSimulationRunner: {
      schedule(revision) {
        scheduledRevision = revision;
      }
    },
    randomDistributionRunner: { schedule() {} },
    modifierContributionRunner: { schedule() {} },
    relicComparisonRunner: { schedule() {} },
    adapter: {
      renderRotationBuilder(renderedApp) {
        renderedResults.push(renderedApp.results.id);
      }
    }
  });

  app.changed(false);
  assert.equal(scheduledRevision, 2);
  assert.deepEqual(renderedResults, [], 'the prior builder remains until the worker result is ready');

  app.publishBaselineSimulation({ result: { id: 'new' }, patchComparison: null }, 2);
  assert.deepEqual(renderedResults, ['new']);
  assert.equal(app.resultRevision, 2);
  assert.equal(app.deferredRotationRenderRevision, null);
});

test('baseline runner publishes only the newest revision and reuses one worker', (t) => {
  runTimersImmediately(t);
  const workerDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  t.after(() => {
    if (workerDescriptor) Object.defineProperty(globalThis, 'Worker', workerDescriptor);
    else delete globalThis.Worker;
  });

  const workers = [];
  class ControlledWorker {
    constructor() {
      this.listeners = new Map();
      this.messages = [];
      workers.push(this);
    }

    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }

    postMessage(message) {
      this.messages.push(message);
    }

    terminate() {}

    respond(message) {
      this.listeners.get('message')?.({ data: message });
    }
  }
  Object.defineProperty(globalThis, 'Worker', {
    configurable: true,
    writable: true,
    value: ControlledWorker
  });

  const published = [];
  const app = {
    buildRevision: 1,
    simulationStatus: 'idle',
    simulationError: '',
    adapter: {
      baselineSimulationRequest() {
        return {
          professionId: 'necromancer',
          rotation: [],
          baseConfig: {},
          selectedPatchId: 'current'
        };
      }
    },
    publishBaselineSimulation(output, revision) {
      published.push([output.result.id, revision]);
    },
    failBaselineSimulation(error) {
      assert.fail(error);
    }
  };
  const runner = new BaselineSimulationRunner(app);

  runner.schedule(1);
  app.buildRevision = 2;
  runner.schedule(2);
  assert.equal(workers.length, 1);
  assert.equal(workers[0].messages.length, 1, 'newer work waits instead of running concurrently');

  workers[0].respond({ requestId: 1, revision: 1, output: { result: { id: 'old' }, patchComparison: null } });
  assert.deepEqual(published, [], 'the superseded result is not published');
  assert.equal(workers[0].messages.length, 2);

  workers[0].respond({ requestId: 2, revision: 2, output: { result: { id: 'new' }, patchComparison: null } });
  assert.deepEqual(published, [['new', 2]]);
  assert.equal(workers.length, 1, 'the persistent worker handles both jobs');
});

test('modifier fallback clears stale state when calculation fails', (t) => {
  runTimersImmediately(t);
  let renderCount = 0;
  const results = {
    contributions: [],
    modifierContributionsStale: false
  };
  const app = {
    build: { rotation: STRIKE_ROTATION },
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
    build: { rotation: STRIKE_ROTATION },
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

test('RNG runner limits parallel workers for a condition-tick-heavy baseline', (t) => {
  runTimersImmediately(t);
  const workerDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  t.after(() => {
    if (workerDescriptor) {
      Object.defineProperty(globalThis, 'Worker', workerDescriptor);
    } else {
      delete globalThis.Worker;
    }

    if (navigatorDescriptor) {
      Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
    } else {
      delete globalThis.navigator;
    }
  });

  const workers = [];
  class PendingWorker {
    constructor() {
      workers.push(this);
    }

    addEventListener() {}

    terminate() {}

    postMessage() {}
  }

  Object.defineProperty(globalThis, 'Worker', {
    configurable: true,
    writable: true,
    value: PendingWorker
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    writable: true,
    value: { hardwareConcurrency: 16 }
  });

  const app = {
    build: { rotation: STRIKE_ROTATION },
    results: {
      events: Array.from({ length: 4000 }, () => ({})),
      resolvedEvents: Array.from({ length: 4000 }, () => ({ damageTicks: [{}] }))
    },
    adapter: {
      randomDistributionRequest() {
        return { trials: 500 };
      },
      renderResults() {}
    }
  };

  new RandomDistributionRunner(app).schedule(true);

  assert.equal(workers.length, 2);
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
    build: { rotation: STRIKE_ROTATION, relic: 'Fractal' },
    results,
    adapter: {
      relicComparisonRequest() {
        return {
          professionId: 'engineer',
          rotation: STRIKE_ROTATION,
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
    build: { rotation: STRIKE_ROTATION, relic: 'Fractal' },
    results,
    adapter: {
      relicComparisonRequest() {
        return {
          professionId: 'engineer',
          rotation: STRIKE_ROTATION,
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
    build: { rotation: STRIKE_ROTATION, relic: 'Akeem' },
    results,
    adapter: {
      relicComparisonRequest() {
        return {
          professionId: 'engineer',
          rotation: STRIKE_ROTATION,
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
