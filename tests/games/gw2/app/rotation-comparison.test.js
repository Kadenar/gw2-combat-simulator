import assert from 'node:assert/strict';
import test from 'node:test';

import { manifestRotationMatchesBuild } from '#gw2/app/import-export/rotation-import-dialog.js';
import { ProfessionApp } from '#gw2/app/profession-app.js';
import {
  beginRotationComparison,
  failRotationReference,
  publishRotationReference,
  queueRotationReference
} from '#gw2/app/rotation/comparison-state.js';
import {
  rotationComparisonMetrics,
  rotationComparisonMetricsFromSeries,
  rotationComparisonTimeMs
} from '#gw2/app/rotation/comparison.js';
import { authoredStepIndexesAtPreviewTime, rotationPreviewSchedulerTimeMs } from '#gw2/app/rotation/timeline/view.js';
import { BaselineSimulationRunner } from '#gw2/app/simulation/baseline/runner.js';
import { revenantAppAdapter } from '#gw2/professions/revenant/app/app-definition.js';
import { effectFields } from '#tests/helpers/effect-report.js';

function result(id, dps = 100, totalDamage = 400, duration = 4, resolvedEvents = []) {
  return {
    id,
    dps,
    totalDamage,
    dpsStartTime: 0,
    dpsWindow: duration,
    rotationEndTime: duration,
    observationEndTime: duration,
    combatEndTime: duration,
    steps: [],
    ...effectFields(resolvedEvents, duration),
    breakdown: [],
    resolvedEvents
  };
}

function comparisonApp(rotation = [{ type: 'cast', skillId: 1 }], currentResult = result('current')) {
  const scheduledRevisions = [];

  return Object.assign(Object.create(ProfessionApp.prototype), {
    build: { rotation },
    buildRevision: 1,
    resultRevision: 1,
    results: currentResult,
    rotationComparison: null,
    simulationStatus: 'idle',
    simulationError: '',
    scheduledRevisions,
    baselineSimulationRunner: {
      schedule(revision) {
        scheduledRevisions.push(revision);
      }
    },
    changedCalls: [],
    changed(...args) {
      this.changedCalls.push(args);
      this.buildRevision += 1;
      this.simulationStatus = 'queued';
    }
  });
}

test('manifest references require the same profession and selected skill set', () => {
  const catalog = revenantAppAdapter.profession.catalog;
  const current = {
    ...revenantAppAdapter.profession.createBuildDefaults(),
    selectedSkillIds: { Heal: 10176, Utility1: 'Blink', Elite: 10311 }
  };

  assert.equal(
    manifestRotationMatchesBuild(
      {
        ...current,
        selectedSkillIds: { Elite: 10311, Heal: 10176, Utility1: 'Blink' }
      },
      current,
      catalog
    ),
    true
  );
  assert.equal(
    manifestRotationMatchesBuild(
      {
        ...current,
        selectedSkillIds: { Heal: 10176, Utility1: 10202, Elite: 10311 }
      },
      current,
      catalog
    ),
    false
  );
  assert.equal(
    manifestRotationMatchesBuild(
      {
        ...current,
        profession: 'necromancer',
        selectedSkillIds: { Heal: 10176, Utility1: 'Blink', Elite: 10311 }
      },
      current,
      catalog
    ),
    false
  );
});

// Empty Revenant skill slots must not make different elite specializations or weapon sets compatible.
test('manifest references require the same elite specialization and both ordered weapon sets', () => {
  const catalog = revenantAppAdapter.profession.catalog;
  const current = {
    ...revenantAppAdapter.profession.createBuildDefaults(),
    selectedSkillIds: {},
    specializations: ['Devastation', 'Invocation', 'Conduit'].map((name) => ({ name, traits: '1-1-1' })),
    weapons: ['Sword', 'Sword'],
    alternateWeapons: ['Greatsword', '']
  };
  const matches = (candidate) => manifestRotationMatchesBuild(candidate, current, catalog);
  assert.equal(matches(structuredClone(current)), true);

  for (const name of ['Renegade', 'Herald', 'Vindicator', 'Retribution']) {
    const candidate = structuredClone(current);
    candidate.specializations[2].name = name;
    assert.equal(matches(candidate), false, name);
  }

  for (const equipment of [
    { weapons: ['Scepter', 'Sword'] },
    { weapons: ['Sword', 'Axe'] },
    { alternateWeapons: ['Staff', ''] },
    { weapons: current.alternateWeapons, alternateWeapons: current.weapons },
    { weapons: undefined },
    { alternateWeapons: undefined }
  ]) {
    assert.equal(matches({ ...current, ...equipment }), false);
  }

  for (const specializations of [undefined, [], [null, null, null]]) {
    assert.equal(matches({ ...current, specializations }), false);
  }

  // Core trait lines, trait choices, and equipment bonuses can vary without changing rotation access.
  const candidate = structuredClone(current);
  candidate.specializations[0] = { name: 'Retribution', traits: '3-3-3' };
  candidate.specializations.reverse();
  candidate.weaponSigils = [
    ['Force', 'Air'],
    ['Force', 'Air']
  ];
  assert.equal(matches(candidate), true);
  current.specializations[2].name = 'Retribution';
  assert.equal(matches(structuredClone(current)), true);
});

test('comparison rejects empty or stale Current and opens with an empty reference', () => {
  const empty = comparisonApp([]);
  empty.startRotationComparison();
  assert.equal(empty.rotationComparison, null);

  const stale = comparisonApp();
  stale.resultRevision = 0;
  stale.startRotationComparison();
  assert.equal(stale.rotationComparison, null);

  const app = comparisonApp();
  app.startRotationComparison();
  assert.deepEqual(app.rotationComparison, {
    view: 'timelines',
    windowMode: 'shared',
    reference: null,
    referenceRotation: [],
    referenceResult: null,
    referenceStatus: 'empty',
    referenceError: ''
  });
});

// Encounter workspaces cannot start either reference workflow, even with fresh simulation results.
test('boss scenarios reject comparison and insights without queuing a reference', () => {
  for (const view of ['timelines', 'insights']) {
    const app = comparisonApp();
    app.workspace = { scenario: { encounterId: '020102', difficulty: 'normal' } };
    const current = app.results;
    const rotation = app.build.rotation;
    assert.equal(beginRotationComparison(app, view), false);
    app.startRotationComparison();
    app.loadRotationReference([{ type: 'cast', skillId: 2 }]);
    assert.equal(app.rotationComparison, null);
    assert.deepEqual(app.scheduledRevisions, []);
    assert.equal(app.results, current);
    assert.equal(app.build.rotation, rotation);

    app.workspace = {};
    assert.equal(beginRotationComparison(app, view), true);
    app.loadRotationReference([{ type: 'cast', skillId: 2 }]);
    assert.equal(app.rotationComparison.referenceStatus, 'queued');
    assert.deepEqual(app.scheduledRevisions, [1]);
  }
});

// The standalone report pins the same reference without requiring the two-timeline workspace.
test('standalone insights retain reference and window selection when entering comparison', () => {
  const app = comparisonApp();
  assert.equal(beginRotationComparison(app, 'insights'), true);
  app.loadRotationReference([{ type: 'cast', skillId: 2 }]);
  app.rotationComparison.reference = { label: 'Report reference', warnings: [] };
  const session = app.rotationComparison;
  session.windowMode = 'full';
  publishRotationReference(app, result('reference'));
  app.simulationStatus = 'idle';
  app.startRotationComparison();
  assert.equal(app.rotationComparison, session);
  assert.equal(session.view, 'timelines');
  assert.equal(session.windowMode, 'full');
  assert.equal(session.reference.label, 'Report reference');
  assert.equal(session.referenceStatus, 'fresh');
  assert.equal(app.scheduledRevisions.length, 1);
});

test('loading and clearing Reference preserve Current and its history', () => {
  const app = comparisonApp();
  app._rotationHistory = { undo: [[{ type: 'wait', durationMs: 1 }]], redo: [], current: app.build.rotation };
  app.startRotationComparison();
  const history = app._rotationHistory;
  const current = app.build.rotation;
  const loaded = [{ type: 'cast', skillId: 2 }];

  app.loadRotationReference(loaded);
  assert.deepEqual(app.rotationComparison.referenceRotation, loaded);
  assert.notEqual(app.rotationComparison.referenceRotation, loaded);
  assert.notEqual(app.rotationComparison.referenceRotation[0], loaded[0]);
  assert.equal(app.rotationComparison.referenceResult, null);
  assert.equal(app.rotationComparison.referenceStatus, 'queued');
  assert.deepEqual(app.scheduledRevisions, [1]);
  assert.equal(app.build.rotation, current);
  assert.equal(app._rotationHistory, history);

  app.clearRotationReference();
  assert.deepEqual(app.rotationComparison.referenceRotation, []);
  assert.equal(app.rotationComparison.referenceResult, null);
  assert.equal(app.rotationComparison.referenceStatus, 'empty');
  assert.equal(app.build.rotation, current);
  assert.equal(app._rotationHistory, history);

  app.exitRotationComparison();
  assert.equal(app.rotationComparison, null);
  assert.equal(app.build.rotation, current);
  assert.equal(app._rotationHistory, history);
});

// Reference state admits only queued completions, so late callbacks cannot resurrect a cleared reference.
test('reference completion and failure respect the comparison lifecycle', () => {
  const app = comparisonApp();
  const current = app.results;
  const reference = result('reference');
  app.startRotationComparison();
  app.loadRotationReference([{ type: 'cast', skillId: 2 }]);
  app.clearRotationReference();
  publishRotationReference(app, reference);
  failRotationReference(app, 'Late failure');
  assert.equal(app.rotationComparison.referenceStatus, 'empty');
  assert.equal(app.rotationComparison.referenceResult, null);
  assert.equal(app.rotationComparison.referenceError, '');

  app.loadRotationReference([{ type: 'cast', skillId: 2 }]);
  publishRotationReference(app, reference);
  failRotationReference(app, 'Already completed');
  assert.equal(app.rotationComparison.referenceStatus, 'fresh');
  assert.equal(app.rotationComparison.referenceResult, reference);
  assert.equal(app.rotationComparison.referenceError, '');

  queueRotationReference(app);
  failRotationReference(app, 'Failed refresh');
  assert.equal(app.rotationComparison.referenceStatus, 'error');
  assert.equal(app.rotationComparison.referenceError, 'Failed refresh');
  queueRotationReference(app);
  assert.equal(app.rotationComparison.referenceStatus, 'queued');
  assert.equal(app.rotationComparison.referenceError, '');
  assert.equal(app.results, current);
});

// Exercise the real queue: replacing a reference does not require a second ID in the simulation payload.
test('the baseline queue rejects replaced references at the same build revision', (t) => {
  t.mock.method(globalThis, 'setTimeout', (callback) => {
    callback();
    return null;
  });
  const previousWorker = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  const workers = [];
  class ControlledWorker {
    listeners = new Map();
    messages = [];
    constructor() {
      workers.push(this);
    }
    addEventListener(type, callback) {
      this.listeners.set(type, callback);
    }
    postMessage(message) {
      this.messages.push(message);
    }
    terminate() {}
    respond(job, payload) {
      this.listeners.get('message')({ data: { requestId: job.requestId, ...payload } });
    }
  }
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: ControlledWorker });
  t.after(() => {
    if (previousWorker) Object.defineProperty(globalThis, 'Worker', previousWorker);
    else delete globalThis.Worker;
  });
  const app = comparisonApp();
  app.adapter = {
    baselineSimulationRequest: () => ({
      rotation: app.build.rotation,
      referenceRotation: app.rotationComparison?.referenceRotation
    })
  };
  app.publishBaselineSimulation = (output) => {
    app.results = output.result;
    app.simulationStatus = 'idle';
    publishRotationReference(app, output.referenceResult);
  };

  app.failBaselineSimulation = (error) => failRotationReference(app, error);
  app.baselineSimulationRunner = new BaselineSimulationRunner(app);
  t.after(() => app.baselineSimulationRunner.cancel());
  app.startRotationComparison();
  app.loadRotationReference([{ type: 'cast', skillId: 1 }]);
  app.rotationComparison.reference = { label: 'Old import', warnings: [], publishedBenchmarks: { current: 40000 } };
  const worker = workers[0];
  const oldJob = worker.messages[0];
  app.loadRotationReference([{ type: 'cast', skillId: 2 }]);
  assert.equal(app.rotationComparison.reference, null, 'replacement drops old import context');
  worker.respond(oldJob, { output: { result: result('old-current'), referenceResult: result('old-reference') } });
  assert.equal(app.results.id, 'current');
  assert.equal(app.rotationComparison.referenceResult, null);
  const replacement = worker.messages[1];
  worker.respond(replacement, { output: { result: result('current'), referenceResult: result('fresh') } });
  assert.equal(app.rotationComparison.referenceResult.id, 'fresh');

  // Superseded failures likewise cannot fail the newly requested reference.
  app.loadRotationReference([{ type: 'cast', skillId: 3 }]);
  const failedJob = worker.messages[2];
  app.loadRotationReference([{ type: 'cast', skillId: 4 }]);
  worker.respond(failedJob, { error: 'Old failure' });
  assert.equal(app.rotationComparison.referenceStatus, 'queued');
  assert.equal(app.rotationComparison.referenceError, '');

  // Clear does not schedule a new baseline; the existing session guard rejects its late reference output.
  const clearedJob = worker.messages[3];
  app.clearRotationReference();
  worker.respond(clearedJob, { output: { result: result('current'), referenceResult: result('cleared') } });
  assert.equal(app.rotationComparison.referenceStatus, 'empty');
  assert.equal(app.rotationComparison.referenceResult, null);

  app.loadRotationReference([{ type: 'cast', skillId: 5 }]);
  const closedJob = worker.messages[4];
  app.exitRotationComparison();
  worker.respond(closedJob, { output: { result: result('current'), referenceResult: result('closed') } });
  assert.equal(app.rotationComparison, null);
});

test('swap exchanges independent rotations and results and resets Current history', () => {
  const referenceRotation = [{ type: 'cast', skillId: 1 }];
  const currentRotation = [{ type: 'cast', skillId: 2 }];
  const referenceResult = result('reference');
  const currentResult = result('current');
  const app = comparisonApp(currentRotation, currentResult);
  app.rotationComparison = {
    view: 'timelines',
    windowMode: 'shared',
    reference: { label: 'Test reference', warnings: [] },
    referenceRotation,
    referenceResult,
    referenceStatus: 'fresh',
    referenceError: ''
  };
  app._rotationHistory = { undo: [[{ type: 'cast', skillId: 3 }]], redo: [], current: currentRotation };

  app.swapRotationComparison();

  assert.deepEqual(app.build.rotation, referenceRotation);
  assert.notEqual(app.build.rotation, referenceRotation);
  assert.notEqual(app.build.rotation[0], referenceRotation[0]);
  assert.deepEqual(app.rotationComparison.referenceRotation, currentRotation);
  assert.notEqual(app.rotationComparison.referenceRotation, currentRotation);
  assert.notEqual(app.rotationComparison.referenceRotation[0], currentRotation[0]);
  assert.equal(app.results, referenceResult);
  assert.equal(app.rotationComparison.referenceResult, currentResult);
  assert.deepEqual(app._rotationHistory.undo, []);
  assert.deepEqual(app._rotationHistory.redo, []);
  assert.deepEqual(app.changedCalls, [[false]]);
  assert.equal(app.resultRevision, app.buildRevision, 'the cached reference result stays paintable while queued');
});

// Cursor checkpoints use scheduler milliseconds, while comparison metrics use elapsed combat time.
test('comparison follows the insertion checkpoint and restores final metrics at the end', () => {
  const app = {
    build: {
      rotation: [
        { type: 'wait', durationMs: 2750 },
        { type: 'wait', durationMs: 1000 }
      ]
    },
    results: { dpsStartTime: 2 },
    rotationInsertionIndex: 1,
    adapter: {
      rotationPlanningStateAt(_app, index) {
        return { atSeconds: index === 0 ? 0 : 2.75 };
      }
    }
  };

  assert.equal(rotationComparisonTimeMs(app), 750);
  app.rotationInsertionIndex = 0;
  assert.equal(rotationComparisonTimeMs(app), 0, 'precombat cursor positions start at zero DPS elapsed time');
  for (const index of [null, 2, 3]) {
    app.rotationInsertionIndex = index;
    assert.equal(rotationComparisonTimeMs(app), null);
  }

  app.rotationInsertionIndex = 1;
  app.results = { firstHitTime: 1 };
  assert.equal(rotationComparisonTimeMs(app), 1750);
  app.results = null;
  assert.equal(rotationComparisonTimeMs(app), null);
});

test('final and timed metrics compare the correct endpoints at one elapsed time', () => {
  const reference = result('reference', 100, 400, 4, [
    { type: 'damage', at: 1, damage: 100 },
    { type: 'damage', at: 2, damage: 200 }
  ]);
  const current = result('current', 150, 600, 3, [
    { type: 'damage', at: 1, damage: 200 },
    { type: 'damage', at: 2, damage: 300 }
  ]);

  const final = rotationComparisonMetrics(reference, current, null);
  assert.deepEqual(
    {
      referenceDps: final.referenceDps,
      currentDps: final.currentDps,
      referenceDamage: final.referenceDamage,
      currentDamage: final.currentDamage,
      dpsDifference: final.dpsDifference,
      dpsPercentDifference: final.dpsPercentDifference
    },
    {
      referenceDps: 100,
      currentDps: 150,
      referenceDamage: 400,
      currentDamage: 600,
      dpsDifference: 50,
      dpsPercentDifference: 50
    }
  );

  const timed = rotationComparisonMetrics(reference, current, 2000);
  assert.equal(timed.timeMs, 2000);
  assert.equal(timed.referenceDamage, 300);
  assert.equal(timed.currentDamage, 500);
  assert.equal(timed.referenceDps, 150);
  assert.equal(timed.currentDps, 250);
});

test('timed metrics clamp to the shorter window and avoid invalid zero-baseline percentages', () => {
  const projection = rotationComparisonMetricsFromSeries(
    result('reference', 0, 0),
    result('current', 10, 10),
    { durationMs: 4000, dps: [{ t: 0, v: 0 }], cumulativeDamage: [{ t: 0, v: 0 }], effects: {} },
    { durationMs: 2250, dps: [{ t: 0, v: 10 }], cumulativeDamage: [{ t: 0, v: 10 }], effects: {} },
    9000
  );

  assert.equal(projection.timeMs, 2250);
  assert.equal(projection.dpsPercentDifference, null);
  assert.equal(projection.damagePercentDifference, null);
});

test('preview scheduler conversion highlights concurrent authored steps and ignores injected steps', () => {
  const previewResult = {
    dpsStartTime: 2,
    steps: [
      { ri: 0, start: 0, end: 1000 },
      { ri: 1, start: 2200, end: 2700 },
      { ri: 2, start: 2400, end: 2600 },
      { ri: -1, start: 2400, end: 2600 }
    ]
  };

  assert.equal(rotationPreviewSchedulerTimeMs(previewResult, 500), 2500);
  assert.deepEqual(authoredStepIndexesAtPreviewTime(previewResult, 500), [1, 2]);
  assert.deepEqual(authoredStepIndexesAtPreviewTime(previewResult, 900), [2]);
});
