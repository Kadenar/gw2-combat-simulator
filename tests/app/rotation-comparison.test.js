import assert from 'node:assert/strict';
import test from 'node:test';

import { ProfessionApp } from '#gw2/app/profession-app.js';
import { manifestRotationMatchesBuild } from '#gw2/app/build/io/rotation-import-dialog.js';
import {
  rotationComparisonMetrics,
  rotationComparisonMetricsFromSeries,
  rotationComparisonTimeMs
} from '#gw2/app/rotation/comparison.js';
import { authoredStepIndexesAtPreviewTime, rotationPreviewSchedulerTimeMs } from '#gw2/app/rotation/timeline/view.js';

function result(id, dps = 100, totalDamage = 400, duration = 4, resolvedEvents = []) {
  return {
    id,
    dps,
    totalDamage,
    dpsStartTime: 0,
    dpsWindow: duration,
    duration,
    steps: [],
    events: [],
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
  const current = {
    profession: 'mesmer',
    selectedSkills: { Heal: 'Ether Feast', Utility1: 'Blink', Elite: 'Time Warp' }
  };

  assert.equal(
    manifestRotationMatchesBuild(
      {
        profession: 'mesmer',
        selectedSkills: { Elite: 'Time Warp', Heal: 'Ether Feast', Utility1: 'Blink' }
      },
      current
    ),
    true
  );
  assert.equal(
    manifestRotationMatchesBuild(
      {
        profession: 'mesmer',
        selectedSkills: { Heal: 'Ether Feast', Utility1: 'Mirror Images', Elite: 'Time Warp' }
      },
      current
    ),
    false
  );
  assert.equal(
    manifestRotationMatchesBuild(
      {
        profession: 'necromancer',
        selectedSkills: { Heal: 'Ether Feast', Utility1: 'Blink', Elite: 'Time Warp' }
      },
      current
    ),
    false
  );
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
    referenceRotation: [],
    referenceResult: null,
    referenceStatus: 'empty',
    referenceError: ''
  });
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

test('swap exchanges independent rotations and results and resets Current history', () => {
  const referenceRotation = [{ type: 'cast', skillId: 1 }];
  const currentRotation = [{ type: 'cast', skillId: 2 }];
  const referenceResult = result('reference');
  const currentResult = result('current');
  const app = comparisonApp(currentRotation, currentResult);
  app.rotationComparison = {
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
      rotationEndStateAt(_app, index) {
        return { time: index === 0 ? 0 : 2750 };
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
  assert.equal(timed.maximumTimeMs, 3000);
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
