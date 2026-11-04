/** Visited patch results can be compared only while their shared inputs and preview assumptions remain valid. */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  invalidatePatchResults,
  needsPatchComparison,
  recordPatchResult,
  reusablePatchResult
} from '#gw2/app/patch-preview/results.js';
import { ProfessionApp } from '#gw2/app/profession-app.js';
import { ModifierContributionRunner } from '#gw2/app/simulation/modifier-contributions/runner.js';

function fixture() {
  const catalog = { skills: [], skillsById: new Map() };
  return {
    build: { rotation: [], selectedSkillIds: {} },
    activeCatalog: catalog,
    profession: { preview: { id: 'preview' }, resolvePatch: ({ id }) => ({ id, catalog }) },
    patch: { id: 'current' },
    simulationSettings: { transitionDelays: { weaponSwap: 0 } },
    patchComparison: null
  };
}

test('comparison requires visits to both patches and invalidates both sides after an edit', () => {
  const app = fixture();
  const live = { dps: 10 };
  const preview = { dps: 20 };
  assert.equal(recordPatchResult(app, live), null);
  assert.equal(needsPatchComparison(app), true);
  app.patch = { id: 'preview' };
  assert.equal(needsPatchComparison(app), false, 'the opposite version is already fresh after a version switch');
  app.patchComparison = recordPatchResult(app, preview);
  assert.deepEqual(app.patchComparison, { current: live, preview });

  invalidatePatchResults(app);
  assert.equal(app.patchComparison, null);
  assert.equal(needsPatchComparison(app), true);
  const edited = { dps: 30 };
  assert.equal(recordPatchResult(app, edited), null);
  app.patch = { id: 'current' };
  assert.deepEqual(recordPatchResult(app, live), { current: live, preview: edited });
});

test('visited results remain scoped to a build and its simulation settings', () => {
  const app = fixture();
  const original = app.build;
  const live = { dps: 10 };
  recordPatchResult(app, live);
  app.build = { rotation: [], selectedSkillIds: {} };
  app.patch = { id: 'preview' };
  assert.equal(recordPatchResult(app, { dps: 20 }), null);

  app.build = original;
  assert.deepEqual(recordPatchResult(app, { dps: 30 }), { current: live, preview: { dps: 30 } });
  app.simulationSettings.transitionDelays.weaponSwap = 100;
  assert.equal(recordPatchResult(app, { dps: 40 }), null);
  app.patch = { id: 'current' };
  assert.deepEqual(recordPatchResult(app, { dps: 50 }), { current: { dps: 50 }, preview: { dps: 40 } });
});

// Returning to a version reuses only exactly matching run inputs and diagnostic capture mode.
test('return visits reject changed selections, settings, diagnostics, and preview tuning', () => {
  const app = fixture();
  const live = { dps: 10 };
  recordPatchResult(app, live);
  assert.equal(reusablePatchResult(app), live);
  app.damageDiagnostics = true;
  assert.equal(reusablePatchResult(app), null);
  app.damageDiagnostics = false;
  app.build.selectedSkillIds.Utility1 = 1;
  assert.equal(reusablePatchResult(app), null);
  delete app.build.selectedSkillIds.Utility1;
  app.simulationSettings.transitionDelays.weaponSwap = 100;
  assert.equal(reusablePatchResult(app), null);
  app.simulationSettings.transitionDelays.weaponSwap = 0;
  app.patch = { id: 'preview', values: { charges: 3 } };
  const next = { dps: 20 };
  recordPatchResult(app, next);
  assert.equal(reusablePatchResult(app), next);
  app.patch = { id: 'preview' };
  assert.equal(reusablePatchResult(app), null);
  app.patch = { id: 'current' };
  assert.equal(reusablePatchResult(app), live);
  invalidatePatchResults(app);
  assert.equal(reusablePatchResult(app), null);
});

test('reset preview tuning cannot label a previously tuned result as the default preview', () => {
  const app = fixture();
  const live = { dps: 10 };
  recordPatchResult(app, live);
  app.patch = { id: 'preview', values: { charges: 3 } };
  assert.deepEqual(recordPatchResult(app, { dps: 20 }), { current: live, preview: { dps: 20 } });
  app.patch = { id: 'current' };
  assert.equal(recordPatchResult(app, live), null);
  app.patch = { id: 'preview' };
  assert.deepEqual(recordPatchResult(app, { dps: 30 }), { current: live, preview: { dps: 30 } });
});

test('stale baseline publication cannot populate a comparison for a newly selected patch', () => {
  const app = Object.assign(fixture(), {
    commitBaselineSimulation: ProfessionApp.prototype.commitBaselineSimulation,
    buildRevision: 2,
    resultRevision: 1,
    results: { dps: 10 }
  });
  ProfessionApp.prototype.publishBaselineSimulation.call(app, { result: { dps: 999 } }, 1);
  assert.equal(app.results.dps, 10);
  app.patch = { id: 'preview' };
  assert.equal(recordPatchResult(app, { dps: 20 }), null);
});

// A fresh return visit keeps baseline identity so completed analyses can be restored without a worker job.
test('baseline runner reuses a matching cached patch on return', async (t) => {
  const { BaselineSimulationRunner } = await import('#gw2/app/simulation/baseline/runner.js');
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { body: { dataset: { simulatorView: 'workspace' } } }
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  });
  const app = fixture();
  const cached = { dps: 123 };
  recordPatchResult(app, cached);
  app.adapter = { baselineSimulationRequest: () => ({ rotation: [], baseConfig: {}, selectedPatchId: 'current' }) };
  app.publishBaselineSimulation = (output, revision) => {
    assert.equal(revision, 2);
    assert.equal(output.result.dps, 123);
    assert.equal(output.result, cached);
    app.results = output.result;
  };

  const runner = new BaselineSimulationRunner(app);
  runner.queue.schedule = () => assert.fail('A matching cached baseline must not be simulated again');
  runner.schedule(2);
  assert.equal(app.results.dps, 123);
});

test('boss workspaces never populate the Golem patch comparison', () => {
  const app = fixture();
  app.workspace = { scenario: {} };
  assert.equal(recordPatchResult(app, { dps: 10 }), null);
  app.patch = { id: 'preview' };
  assert.equal(recordPatchResult(app, { dps: 20 }), null);
});

// Restoring either patch keeps its own completed analyses and does not prepare follow-up simulations.
test('cached patch publication preserves completed modifiers and randomized outcomes', (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { body: { dataset: { simulatorView: 'analysis' } } }
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  });
  const app = fixture();
  app.build.rotation = [{ type: 'wait', durationMs: 1000 }];
  let samplingSchedules = 0;
  Object.assign(app, {
    buildRevision: 1,
    adapter: { modifierContributionRequest: () => assert.fail('Completed modifiers must be reused') },
    randomDistributionRunner: { schedule: () => samplingSchedules++ },
    relicComparisonRunner: { schedule() {} }
  });
  app.modifierContributionRunner = new ModifierContributionRunner(app);
  t.after(() => app.modifierContributionRunner.cancel());
  const completed = (dps) => ({
    dps,
    contributions: [{ id: `modifier-${dps}` }],
    modifierContributionsStale: false,
    randomDistributionRequested: true,
    randomDistributionStale: false,
    randomDistribution: { mean: dps, trials: 500 },
    randomDistributionProgress: { completed: 500, total: 500, percent: 100 }
  });
  const live = completed(10);
  const preview = completed(20);
  recordPatchResult(app, live);
  app.patch = { id: 'preview' };
  recordPatchResult(app, preview);
  app.results = preview;
  for (const [id, result] of [
    ['current', live],
    ['preview', preview],
    ['current', live]
  ]) {
    app.patch = { id };
    app.buildRevision++;
    ProfessionApp.prototype.commitBaselineSimulation.call(
      app,
      { result: reusablePatchResult(app) },
      app.buildRevision,
      false
    );
    assert.equal(app.results, result);
    assert.equal(app.results.contributions[0].id, `modifier-${result.dps}`);
    assert.equal(app.results.modifierContributionsStale, false);
    assert.equal(app.modifierContributionRunner.isRunning, false);
    assert.equal(app.results.randomDistributionProgress.percent, 100);
  }

  assert.equal(samplingSchedules, 0);

  // An unfinished user-requested sample must not leave a permanent progress indicator after returning.
  live.randomDistributionStale = true;
  ProfessionApp.prototype.commitBaselineSimulation.call(app, { result: live }, app.buildRevision, false);
  assert.equal(samplingSchedules, 1);

  invalidatePatchResults(app);
  globalThis.document.body.dataset.simulatorView = 'workspace';
  ProfessionApp.prototype.commitBaselineSimulation.call(app, { result: { dps: 30 } }, app.buildRevision, false);
  assert.equal(app.results.modifierContributionsStale, true, 'a new simulation still invalidates modifiers');
  assert.equal(samplingSchedules, 2);
});
