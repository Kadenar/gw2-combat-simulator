/** Execution adapters and request preparation retain their own contracts; lifecycle policy is tested headlessly. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { createBuildTab } from '#gw2/app/build/state/workspace.js';
import { createAnalysisResultLifecycle } from '#gw2/app/create-analysis-lifecycle.js';
import { createProfessionRuntime } from '#gw2/app/create-runtime.js';
import { calculateRelicComparison } from '#gw2/app/optimizer/relic-comparison/calculate.js';
import { RelicComparisonRunner } from '#gw2/app/optimizer/relic-comparison/runner.js';
import { ProfessionApp } from '#gw2/app/profession-app.js';
import { captureAnalysisRequestSnapshot } from '#gw2/app/simulation/analysis-request-snapshot.js';
import { BaselineSimulationRunner } from '#gw2/app/simulation/baseline/runner.js';
import { ModifierContributionRunner } from '#gw2/app/simulation/modifier-contributions/runner.js';
import { RandomDistributionRunner } from '#gw2/app/simulation/random-distribution/runner.js';
import { analysisFixture } from '#tests/helpers/analysis-lifecycle.js';
import { effectFields } from '#tests/helpers/effect-report.js';
import { loadProfessionAppAdapter } from '#tests/helpers/profession-app-adapter.js';

const STRIKE_ROTATION = [{ type: 'cast', skillId: 'Strike' }];

// Supplies the complete presentation contract so runner tests can observe refreshes without mounting the DOM.
function testPresentation(render = () => {}) {
  return { createViewModel: () => ({}), render };
}

function minimalResult(damageAt1s) {
  // buildChartSeries only needs the DPS window, resolved damage events, and
  // (optionally) breakdown/events - keep it minimal but non-empty.
  return {
    dps: damageAt1s / 4,
    dpsStartTime: 0,
    dpsWindow: 4,
    rotationEndTime: 4,
    observationEndTime: 4,
    combatEndTime: 4,
    breakdown: [],
    events: [],
    ...effectFields([{ type: 'damage', at: 1, damage: damageAt1s }], 4)
  };
}

test('relic comparison derives availability without preparing requests or simulating', () => {
  const results = minimalResult(4000);
  let simulated = 0;
  const app = {
    build: { rotation: STRIKE_ROTATION, relic: 'Fractal' },
    relicNames: ['Akeem', 'Fractal', 'Thorns'],
    analysis: {
      state: {
        buildRevision: 0,
        resultRevision: 0,
        simulationStatus: 'idle',
        simulationError: '',
        patchComparison: null,
        results
      }
    },
    profession: {
      runtimeFor() {
        simulated++;
        throw new Error('Unexpected simulation');
      }
    },
    adapter: {
      relicComparisonRequest() {
        assert.fail('Availability must not prepare a simulation request');
      },
      presentation: testPresentation()
    }
  };
  const runner = new RelicComparisonRunner(app);

  runner.schedule();
  assert.equal(runner.available, true);
  assert.equal(app.build.relic, 'Fractal');
  assert.equal(runner.comparisonRelic, 'Thorns');
  assert.equal(simulated, 0, 'scheduling must not run the second simulation');

  runner.comparison = { equippedRelic: 'Fractal', targetRelic: 'Thorns' };
  app.build.relic = 'Thorns';
  runner.schedule();
  assert.equal(runner.comparisonRelic, 'Akeem');
  assert.equal(runner.comparison, null, 'changed selections discard the previous comparison');
  app.relicNames = ['Thorns'];
  runner.schedule();
  assert.equal(runner.available, false, 'the equipped relic cannot compare with itself');
  app.relicNames = ['Thorns', 'Akeem'];
  app.build.relic = '';
  runner.schedule();
  assert.equal(runner.available, false);
  app.build.relic = 'Thorns';
  app.build.rotation = [];
  runner.schedule();
  assert.equal(runner.available, false);
  assert.equal(runner.comparisonRelic, 'Akeem', 'empty rotations retain the shared selection');
  app.analysis.state.results = null;
  runner.schedule();
});

// The calculation owns relic assumptions and counterfactual attribution independently of the runner.
test('relic comparison scopes assumptions and attributes damage against a no-relic simulation', () => {
  const simulatedConfigs = [];
  const simulationOptions = [];
  const results = minimalResult(4000);
  const simulate = ({ config, output, collectChartData }) => {
    simulatedConfigs.push(config);
    simulationOptions.push(output === 'score' ? { output } : { collectChartData });
    return output === 'score' ? { dps: 900 } : minimalResult(4200);
  };

  let comparison;
  for (const comparisonRelic of ['Akeem', 'Thorns', 'Mirage']) {
    comparison = calculateRelicComparison(
      {
        rotation: STRIKE_ROTATION,
        // Comparison stacks override the saved main-run value only for the comparison's Thorns relic.
        baseConfig: { relic: 'Fractal', initialThornsStacks: 8 },
        equippedRelic: 'Fractal',
        comparisonRelic,
        baselineResult: results,
        initialStacks: 4
      },
      {},
      simulate
    );
  }

  assert.deepEqual(
    simulationOptions,
    Array.from({ length: 3 }, () => [{ collectChartData: false }, { output: 'score' }]).flat()
  );
  assert.deepEqual(
    simulatedConfigs.map(({ relic, initialThornsStacks }) => ({ relic, initialThornsStacks })),
    [
      { relic: 'Akeem', initialThornsStacks: 8 },
      { relic: '', initialThornsStacks: 8 },
      { relic: 'Thorns', initialThornsStacks: 4 },
      { relic: '', initialThornsStacks: 8 },
      { relic: 'Mirage', initialThornsStacks: 8 },
      { relic: '', initialThornsStacks: 8 }
    ]
  );
  assert.equal(comparison.equippedRelic, 'Fractal');
  assert.equal(comparison.targetRelic, 'Mirage');
  assert.equal(comparison.opponentFinalDps, results.dps);
  assert.equal(comparison.targetFinalDps, 1050);
  assert.deepEqual(comparison.opponentDamage, { directDamage: 0, contributedDps: 100 });
  assert.deepEqual(comparison.targetDamage, { directDamage: 0, contributedDps: 150 });
});

/** A real profession exercises local calculation without worker transport or timer mocks. */
async function relicFixture() {
  const adapter = await loadProfessionAppAdapter('engineer');
  const rotation = [{ type: 'wait', durationMs: 1000 }];
  const build = adapter.profession.createBuildDefaults();
  build.rotation = rotation;
  build.relic = 'Fractal';
  const prepared = [];
  let updates = 0;
  const app = {
    profession: adapter.profession,
    build,
    patch: adapter.profession.resolvePatch({ id: 'current' }),
    relicNames: ['Akeem', 'Fractal', 'Thorns'],
    analysis: {
      state: {
        simulationError: '',
        patchComparison: null,
        buildRevision: 1,
        resultRevision: 1,
        simulationStatus: 'idle',
        results: minimalResult(4000)
      }
    },

    adapter: createProfessionRuntime({
      profession: adapter.profession,
      createBuildContext(input) {
        const context = adapter.createBuildContext(input);
        return {
          ...context,
          simulationConfig() {
            const config = context.simulationConfig();
            prepared.push(config);
            return config;
          }
        };
      }
    })
  };
  const runner = new RelicComparisonRunner(app, () => {
    updates++;
  });
  return { app, runner, prepared, updates: () => updates };
}

test('relic comparison publishes synchronously without workers and preserves its baseline', async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  Object.defineProperty(globalThis, 'Worker', {
    configurable: true,
    value: class {
      constructor() {
        assert.fail('Relic comparison must not construct a worker.');
      }
    }
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'Worker', previous);
    else delete globalThis.Worker;
  });
  const { app, runner, prepared, updates } = await relicFixture();
  const baseline = app.analysis.state.results;
  runner.schedule();
  assert.equal(prepared.length, 0);
  app.build.targetArmor = 3000;
  runner.run('Thorns', 4);
  assert.equal(prepared.length, 1);
  assert.equal(prepared[0].target.armor, 3000, 'execution prepares the current build rather than the idle refresh');
  assert.equal(app.analysis.state.results, baseline);
  assert.equal(app.analysis.state.results.dps, 1000);
  assert.equal(runner.comparison.targetRelic, 'Thorns');
  assert.equal(runner.initialStacks, 4);
  assert.equal(runner.error, '');
  assert.equal(updates(), 1);
  runner.run('Akeem');
  assert.equal(prepared.length, 2);
  assert.equal(runner.comparison.targetRelic, 'Akeem');
  assert.equal(updates(), 2);
});

// The controls belong to the tool; output belongs to the exact baseline and build revision used by the calculation.
test('relic controls survive baseline changes while stale output is discarded before execution', async () => {
  const { app, runner, prepared } = await relicFixture();
  runner.run('Thorns', 4);
  const comparison = runner.comparison;
  runner.schedule();
  assert.equal(runner.comparison, comparison, 'refreshing the same inputs retains completed output');

  runner.select('Thorns', 8);
  assert.equal(runner.comparison, null, 'changing assumptions invalidates the curve immediately');
  runner.run();
  assert.ok(runner.comparison);
  app.analysis.state.buildRevision++;
  app.analysis.state.simulationStatus = 'queued';
  runner.schedule();
  assert.equal(runner.comparison, null);
  const before = prepared.length;
  runner.run();
  assert.equal(prepared.length, before, 'a queued or stale baseline cannot run a comparison');
  assert.equal(runner.comparisonRelic, 'Thorns');
  assert.equal(runner.initialStacks, 8);

  app.analysis.state.resultRevision = app.analysis.state.buildRevision;
  app.analysis.state.simulationStatus = 'idle';
  runner.run();
  assert.ok(runner.comparison);
  app.analysis.state.results = minimalResult(5000);
  runner.schedule();
  assert.equal(runner.comparison, null, 'replacement baselines invalidate output even at the same revision');
  runner.run();
  assert.equal(runner.comparison.opponentFinalDps, 1250);

  app.analysis.state.results = null;
  runner.schedule();
  assert.equal(runner.available, false);
  assert.equal(runner.comparison, null);
  assert.equal(runner.initialStacks, 8);
  app.build.relic = 'Thorns';
  runner.schedule();
  assert.equal(runner.comparisonRelic, 'Akeem', 'an equipped alternative is replaced with a usable choice');
  runner.select('Akeem', 20.9);
  assert.equal(runner.initialStacks, 10);
  runner.select('Akeem', -5);
  assert.equal(runner.initialStacks, 0);
});

test('relic preparation failures invalidate prior output and remain visible until inputs change or retry', async () => {
  const { app, runner } = await relicFixture();
  runner.run();
  assert.ok(runner.comparison);
  app.adapter.relicComparisonRequest = () => {
    throw new Error('Invalid comparison inputs');
  };

  runner.run();
  assert.equal(runner.comparison, null);
  runner.schedule();
  assert.equal(runner.error, 'Invalid comparison inputs');
  runner.select('Akeem', 0);
  assert.equal(runner.error, '');
});

// Restored patch baselines reuse their own relic result, but changed controls or a new baseline cannot reuse it.
test('relic comparisons survive validated baseline restoration without another simulation', async () => {
  const { app, runner, prepared } = await relicFixture();
  const live = app.analysis.state.results;
  runner.run('Thorns', 4);
  const liveComparison = runner.comparison;
  const preview = minimalResult(5000);
  app.analysis.state.results = preview;
  app.analysis.state.resultRevision = ++app.analysis.state.buildRevision;
  runner.schedule();
  assert.equal(runner.comparison, null);
  runner.run();
  const previewComparison = runner.comparison;
  const requests = prepared.length;
  for (const [result, comparison] of [
    [live, liveComparison],
    [preview, previewComparison]
  ]) {
    app.analysis.state.buildRevision++;
    runner.schedule();
    assert.equal(runner.comparison, null, 'pending baselines cannot display completed comparisons');
    app.analysis.state.results = result;
    app.analysis.state.resultRevision = app.analysis.state.buildRevision;
    runner.schedule();
    assert.equal(runner.comparison, comparison);
  }

  assert.equal(prepared.length, requests);
  runner.select('Thorns', 5);
  runner.schedule();
  assert.equal(runner.comparison, null, 'different starting stacks invalidate the saved comparison');
  runner.select('Akeem', 4);
  runner.schedule();
  assert.equal(runner.comparison, null, 'different relics invalidate the saved comparison');
  runner.select('Thorns', 4);
  app.analysis.state.results = minimalResult(6000);
  runner.schedule();
  assert.equal(runner.comparison, null, 'newly simulated inputs need a new comparison');
  assert.equal(prepared.length, requests);
});

/** Controlled workers expose transport completion without giving tests application-state mutation privileges. */
function controlledWorkers(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const workers = [];
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  class ControlledWorker {
    messages = [];
    listeners = new Map();
    terminated = false;
    constructor() {
      workers.push(this);
    }
    addEventListener(name, listener) {
      this.listeners.set(name, listener);
    }
    postMessage(message) {
      this.messages.push(message);
    }
    terminate() {
      this.terminated = true;
    }
    respond(message, payload) {
      this.listeners.get('message')({ data: { requestId: message.requestId, ...payload } });
    }
  }
  Object.defineProperty(globalThis, 'Worker', { configurable: true, writable: true, value: ControlledWorker });
  t.after(() => (previous ? Object.defineProperty(globalThis, 'Worker', previous) : delete globalThis.Worker));
  return workers;
}

test('baseline execution coalesces pending requests and only publishes the newest operation', (t) => {
  const workers = controlledWorkers(t);
  const runner = new BaselineSimulationRunner(() => assert.fail('Worker path expected'));
  t.after(() => runner.cancel());
  const completed = [];
  const operation = (id) => ({
    request: { id },
    started() {},
    complete: (output) => completed.push(output.result.id),
    fail: assert.fail
  });
  runner.run(operation(1));
  t.mock.timers.tick(40);
  const worker = workers[0];
  const first = worker.messages[0];
  runner.run(operation(2));
  runner.run(operation(3));
  t.mock.timers.tick(40);
  worker.respond(first, { output: { result: { id: 1 } } });
  assert.deepEqual(completed, []);
  assert.equal(worker.messages.at(-1).request.id, 3);
  worker.respond(worker.messages.at(-1), { output: { result: { id: 3 } } });
  assert.deepEqual(completed, [3]);
  runner.run(operation(4));
  t.mock.timers.tick(40);
  assert.equal(workers.length, 1, 'idle worker stays warm');
  runner.cancel();
  assert.equal(worker.terminated, true);
  worker.respond(worker.messages.at(-1), { output: { result: { id: 4 } } });
  assert.deepEqual(completed, [3]);
});

test('modifier execution waits for lifecycle eligibility and merges worker partitions', (t) => {
  const workers = controlledWorkers(t);
  const runner = new ModifierContributionRunner(() => assert.fail('Worker path expected'));
  t.after(() => runner.cancel());
  let ready = false;
  let completed;
  runner.run({
    request: {
      gameId: 'gw2',
      contentId: 'fixture',
      baselineDps: 100,
      rotation: [],
      comparisons: [
        { modifier: { id: 'a', name: 'A' }, config: {} },
        { modifier: { id: 'b', name: 'B' }, config: {} }
      ]
    },
    ready: () => ready,
    complete: (value) => {
      completed = value;
    },
    fail: assert.fail
  });
  t.mock.timers.tick(750);
  assert.equal(workers.length, 0);
  ready = true;
  t.mock.timers.tick(250);
  for (const worker of [...workers].reverse()) {
    const job = worker.messages[0];
    worker.respond(job, {
      scores: job.request.comparisons.map(({ modifier }) => ({
        id: modifier.id,
        name: modifier.name,
        dpsWithoutModifier: 90
      }))
    });
  }

  assert.deepEqual(completed.map(({ id }) => id).sort(), ['a', 'b']);
  assert.ok(workers.every((worker) => worker.terminated));
});

test('RNG execution aggregates progress and rejects messages after cancellation', (t) => {
  const workers = controlledWorkers(t);
  const runner = new RandomDistributionRunner(() => assert.fail('Worker path expected'));
  t.after(() => runner.cancel());
  const progress = [];
  let completed;
  const operation = {
    request: { rotation: [], baseConfig: {}, trials: 2 },
    baseline: { events: [], resolvedEvents: [] },
    progress: (value) => progress.push(value),
    complete: (value) => {
      completed = value;
    },
    fail: assert.fail
  };
  runner.run(operation);
  t.mock.timers.tick(0);
  for (const worker of [...workers].reverse()) {
    const job = worker.messages[0];
    worker.respond(job, { progress: { completed: job.request.trials, total: job.request.trials, percent: 100 } });
    worker.respond(job, { outcomes: Array.from({ length: job.request.trials }, () => ({ dps: 10, metrics: [] })) });
  }

  assert.equal(progress.at(-1).completed, 2);
  assert.equal(completed.trials, 2);
  runner.run({ ...operation, complete: () => assert.fail('Canceled output') });
  t.mock.timers.tick(0);
  const last = workers.at(-1);
  runner.cancel();
  last.respond(last.messages[0], { outcomes: [{ dps: 999, metrics: [] }] });
  assert.equal(last.terminated, true);
});

test('worker construction failures report the cause and a later baseline can retry', (t) => {
  controlledWorkers(t);
  const WorkingWorker = globalThis.Worker;
  const cause = new Error('construction failed');
  globalThis.Worker = class {
    constructor() {
      throw cause;
    }
  };
  let failed;
  const runner = new BaselineSimulationRunner(() => ({}));
  t.after(() => runner.cancel());
  const operation = {
    request: {},
    started() {},
    complete() {},
    fail: (error) => {
      failed = error;
    }
  };
  runner.run(operation);
  t.mock.timers.tick(40);
  assert.equal(failed, cause);
  assert.equal(runner.queue.isRunning, false);
  globalThis.Worker = WorkingWorker;
  runner.run(operation);
  t.mock.timers.tick(40);
  assert.equal(runner.queue.isRunning, true);
});

// Local calculation failures remain retryable independently of the active analysis lifecycle.
test('local relic comparison reports calculation failures and recovers on retry', async () => {
  const { app, runner, updates } = await relicFixture();
  runner.run();
  assert.ok(runner.comparison);
  const profession = app.profession;
  app.profession = {
    ...profession,
    runtimeFor() {
      throw new Error('Comparison simulation failed.');
    }
  };
  assert.doesNotThrow(() => runner.run());
  assert.equal(runner.error, 'Comparison simulation failed.');
  assert.equal(runner.comparison, null);
  assert.equal(updates(), 2);
  app.profession = profession;
  runner.run();
  assert.equal(runner.error, '');
  assert.equal(runner.comparison.targetRelic, 'Thorns');
  assert.equal(updates(), 3);
});

// Preserve application rendering and persistence contracts around lifecycle transitions.
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

  const f = analysisFixture({ changed: (change) => app.onAnalysisChange(change) });
  let renderedResults = [];
  const app = Object.assign(Object.create(ProfessionApp.prototype), {
    initialRenderGeneration: 0,
    deferredRotationRenderRevision: null,
    build: { rotation: [{ type: 'wait', durationMs: 1000 }] },
    analysis: f.lifecycle,
    templateContainer: null,
    prepareSimulationState: () => app.analysis.changeInputs(),
    relicComparisonRunner: { schedule() {} },
    adapter: {
      renderRotationBuilder(renderedApp) {
        renderedResults.push(renderedApp.analysis.state.results.id);
      }
    }
  });

  app.analysis.restore({
    inputs: f.execution.captureInputs(),
    results: { id: 'old', contributions: [] },
    patchComparison: null,
    fresh: true
  });
  app.changed(false);
  assert.equal(f.work.baseline.length, 1);
  assert.deepEqual(renderedResults, [], 'the prior builder remains until the worker result is ready');

  f.work.baseline[0].complete({ result: { id: 'new' } });
  assert.deepEqual(renderedResults, ['new']);
  assert.equal(app.analysis.state.resultRevision, 2);
  assert.equal(app.deferredRotationRenderRevision, null);
});

// Preserve application rendering and persistence contracts around lifecycle transitions.
test('build edits cancel prior analysis even when browser storage rejects writes', (t) => {
  let storageWrites = 0;
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
    value: { body: { dataset: {} }, getElementById: () => null }
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      setItem() {
        storageWrites += 1;
        throw new DOMException('Storage is full.', 'QuotaExceededError');
      }
    }
  });

  let scheduled = null;
  const cancelled = [];
  const profession = {
    id: 'fixture',
    resolvePatch: () => ({ id: 'current', catalog: { skills: [], skillsById: new Map() } }),
    ui: {},
    migrateBuild: (build) => build
  };
  const adapter = {
    profession,
    storageKey: 'fixture-build',
    toApplicationBuild: (build) => build,
    eliteSpecialization: () => 'Core',
    slotLoadout: { normalizeBuild: () => ({}) },
    createBuildContext: () => ({ attributes: () => null, simulationConfig: () => ({}) }),
    captureAnalysis: (input) => captureAnalysisRequestSnapshot(input, adapter),
    buildEditor: {}
  };
  // Supply normalized build inputs and a real tab so the edit reaches the failing storage write.
  const tab = createBuildTab({
    rotation: [{ type: 'wait', durationMs: 1000 }],
    selectedSkillIds: {},
    infusions: []
  });
  const app = Object.assign(Object.create(ProfessionApp.prototype), {
    patch: { id: 'current', catalog: { skills: [], skillsById: new Map() } },
    initialRenderGeneration: 0,
    deferredRotationRenderRevision: null,
    build: tab.build,
    workspace: { tabs: [tab], activeTabId: tab.id },
    damageDiagnostics: false,
    profession,
    adapter,
    gearOptimizerRunner: { cancel() {} },
    randomDistributionRunner: { cancel: () => cancelled.push('random') },
    modifierContributionRunner: { cancel: () => cancelled.push('modifiers') },
    relicComparisonRunner: { schedule() {} },
    baselineSimulationRunner: {
      cancel() {},
      run(operation) {
        scheduled = operation;
      }
    }
  });

  app.analysis = createAnalysisResultLifecycle(app, () => {});
  app.analysis.restore({
    inputs: app.adapter.captureAnalysis({ build: app.build, patch: app.patch }),
    results: { contributions: [], modifierContributionsStale: false },
    fresh: true,
    patchComparison: null
  });
  cancelled.length = 0;
  const outgoing = app.analysis.state.results;
  assert.doesNotThrow(() => app.changed(false));
  assert.equal(outgoing.modifierContributionsStale, false, 'pending edits must not mutate cached analysis metadata');
  assert.equal(storageWrites, 1);
  assert.ok(app.workspace.storageError);
  assert.equal(app.analysis.state.buildRevision, 2);
  assert.ok(scheduled);
  assert.equal(app.analysis.state.simulationStatus, 'queued');
  assert.equal(
    app.analysis.state.results.modifierContributionsStale,
    true,
    'an edit invalidates modifiers before baseline completion'
  );
  assert.deepEqual(new Set(cancelled), new Set(['random', 'modifiers']));
});
