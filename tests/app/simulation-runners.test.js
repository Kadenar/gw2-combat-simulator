import assert from 'node:assert/strict';
import test from 'node:test';

import { ProfessionApp } from '#gw2/app/profession-app.js';
import { ModifierContributionRunner } from '#gw2/app/simulation/modifier-contribution-runner.js';
import { BaselineSimulationRunner } from '#gw2/app/simulation/baseline-simulation-runner.js';
import { createGameWorkerEndpoint, ManagedWorkerBatch } from '#app/simulation/game-worker-harness.js';
import { RandomDistributionRunner } from '#gw2/app/simulation/random-distribution-runner.js';
import { RelicComparisonRunner } from '#gw2/app/simulation/relic-comparison-runner.js';

const STRIKE_ROTATION = [{ type: 'cast', skillId: 'Strike' }];

// Supplies the complete presentation contract so runner tests can observe refreshes without mounting the DOM.
function testPresentation(render = () => {}) {
  return { createViewModel: () => ({}), render };
}

function runTimersImmediately(t) {
  t.mock.method(globalThis, 'setTimeout', (callback) => {
    callback();

    return 0;
  });
}

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

test('build edits continue when browser storage rejects writes', (t) => {
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  t.after(() => {
    if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor);
    else delete globalThis.document;
    if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
    else delete globalThis.localStorage;
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { body: { dataset: {} } }
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      setItem() {
        throw new DOMException('Storage is full.', 'QuotaExceededError');
      }
    }
  });

  let scheduledRevision = null;
  const profession = {
    ui: {},
    migrateBuild: (build) => build
  };
  const adapter = {
    profession,
    storageKey: 'fixture-build',
    toApplicationBuild: (build) => build,
    eliteSpecialization: () => 'Core',
    slotLoadout: { normalizeBuild: () => ({}) },
    recalculate() {},
    buildEditor: {}
  };
  const app = Object.assign(Object.create(ProfessionApp.prototype), {
    initialRenderGeneration: 0,
    deferredRotationRenderRevision: null,
    build: { rotation: [], selectedSkills: {} },
    buildRevision: 0,
    simulationStatus: 'idle',
    simulationError: '',
    results: null,
    profession,
    adapter,
    activeCatalog: {},
    skillByName: new Map(),
    skills: [],
    baselineSimulationRunner: {
      schedule(revision) {
        scheduledRevision = revision;
      }
    }
  });

  assert.doesNotThrow(() => app.changed(false));
  assert.equal(app.buildRevision, 1);
  assert.equal(scheduledRevision, 1);
  assert.equal(app.simulationStatus, 'queued');
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
          gameId: 'gw2',
          contentId: 'necromancer',
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

test('baseline runner recovers after Worker construction fails', (t) => {
  runTimersImmediately(t);
  const workerDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  t.after(() => {
    if (workerDescriptor) Object.defineProperty(globalThis, 'Worker', workerDescriptor);
    else delete globalThis.Worker;
  });

  let attempts = 0;
  const workers = [];
  class RecoveringWorker {
    constructor() {
      attempts += 1;
      if (attempts === 1) throw new DOMException('Worker blocked.', 'SecurityError');
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
    value: RecoveringWorker
  });

  const failures = [];
  const published = [];
  const app = {
    buildRevision: 1,
    simulationStatus: 'idle',
    simulationError: '',
    adapter: {
      baselineSimulationRequest() {
        return {
          gameId: 'gw2',
          contentId: 'engineer',
          rotation: [],
          baseConfig: {},
          selectedPatchId: 'current'
        };
      }
    },
    publishBaselineSimulation(output, revision) {
      published.push([output.result.id, revision]);
    },
    failBaselineSimulation(error, revision) {
      failures.push([error.name, revision]);
    }
  };
  const runner = new BaselineSimulationRunner(app);

  runner.schedule(1);
  app.buildRevision = 2;
  runner.schedule(2);

  assert.deepEqual(failures, [['SecurityError', 1]]);
  assert.equal(attempts, 2);
  assert.equal(workers[0].messages.length, 1);
  workers[0].respond({ requestId: 2, revision: 2, output: { result: { id: 'new' }, patchComparison: null } });
  assert.deepEqual(published, [['new', 2]]);
});

test('modifier fallback clears stale state when calculation fails', (t) => {
  runTimersImmediately(t);
  let renderCount = 0;
  const results = {
    contributions: [{ id: 'old', name: 'Old', dpsIncrease: 1, pctIncrease: 1 }],
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
      presentation: testPresentation(() => {
        renderCount += 1;
      })
    },
    randomDistributionRunner: { isRunning: false }
  };
  const runner = new ModifierContributionRunner(app);

  assert.doesNotThrow(() => runner.schedule());
  assert.equal(results.modifierContributionsStale, false);
  assert.equal(results.contributions, undefined);
  assert.equal(results.modifierContributionsError, 'Contribution calculation failed.');
  assert.equal(renderCount, 1);
});

test('modifier worker batches ignore superseded responses and terminate on completion', (t) => {
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
      this.terminated = false;
      workers.push(this);
    }

    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }

    postMessage(message) {
      this.message = message;
    }

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

  const results = { contributions: [], modifierContributionsStale: false };
  let renderCount = 0;
  const app = {
    build: { rotation: STRIKE_ROTATION },
    results,
    adapter: {
      modifierContributionRequest() {
        return { comparisons: [{}] };
      },
      presentation: testPresentation(() => {
        renderCount += 1;
      })
    },
    randomDistributionRunner: { isRunning: false }
  };
  const runner = new ModifierContributionRunner(app);

  runner.schedule();
  runner.schedule();
  assert.equal(workers[0].terminated, true);
  workers[0].respond({
    requestId: 1,
    contributions: [{ id: 'old', name: 'Old', dpsIncrease: 1, pctIncrease: 1 }]
  });
  assert.deepEqual(results.contributions, []);

  workers[1].respond({
    requestId: 2,
    contributions: [{ id: 'new', name: 'New', dpsIncrease: 2, pctIncrease: 2 }]
  });
  assert.deepEqual(
    results.contributions.map(({ id }) => id),
    ['new']
  );
  assert.equal(workers[1].terminated, true);
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
      presentation: testPresentation(() => {
        renderCount += 1;
      })
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
      presentation: testPresentation()
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
          gameId: 'gw2',
          contentId: 'engineer',
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
      presentation: testPresentation()
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
          gameId: 'gw2',
          contentId: 'engineer',
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
      presentation: testPresentation(() => {
        renderCount += 1;
      })
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
          gameId: 'gw2',
          contentId: 'engineer',
          rotation: STRIKE_ROTATION,
          baseConfig: { relic: 'Akeem' },
          opponentRelic: 'Akeem',
          comparisonRelic: 'Thorns'
        };
      },
      simulateBuild() {
        throw new Error('Comparison simulation failed.');
      },
      presentation: testPresentation()
    }
  };
  const runner = new RelicComparisonRunner(app);

  runner.run();

  assert.equal(results.relicComparisonStale, false);
  assert.equal(results.relicComparisonError, 'Comparison simulation failed.');
});
