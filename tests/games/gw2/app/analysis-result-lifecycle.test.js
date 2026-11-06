/** Tests result ownership through the same headless interface used by application composition. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { analysisFixture } from '#tests/helpers/analysis-lifecycle.js';

test('same-revision requests reject obsolete success, failure, and start notifications', () => {
  const { lifecycle, work } = analysisFixture();
  lifecycle.refreshBaseline();
  const old = work.baseline.at(-1);
  lifecycle.refreshBaseline();
  const latest = work.baseline.at(-1);
  old.started();
  old.complete({ result: { dps: 999 } });
  old.fail(new Error('obsolete'));
  assert.equal(lifecycle.state.results, null);
  assert.equal(lifecycle.state.simulationStatus, 'queued');
  latest.started();
  assert.equal(lifecycle.state.simulationStatus, 'running');
  const result = { dps: 10 };
  latest.complete({ result });
  latest.fail(new Error('duplicate completion'));
  assert.equal(lifecycle.state.results, result);
  assert.equal(lifecycle.state.simulationStatus, 'idle');
  assert.equal(lifecycle.state.simulationError, '');
});

test('edits invalidate publication and keep stale display separate from the previous baseline', () => {
  const { lifecycle, work, publish, showAnalysis } = analysisFixture();
  const first = publish({ dps: 10, effectReport: {} });
  showAnalysis();
  const modifier = work.modifiers.at(-1);
  modifier.complete([{ id: 'first', dpsIncrease: 2 }]);
  lifecycle.runDistribution();
  const distribution = work.distribution.at(-1);
  lifecycle.changeInputs();
  assert.notEqual(lifecycle.state.results, first);
  assert.equal(first.modifierContributionsStale, false);
  assert.equal(lifecycle.state.results.modifierContributionsStale, true);
  distribution.progress({ completed: 2, total: 2, percent: 100 });
  distribution.complete({ trials: 2, mean: 999 });
  modifier.fail(new Error('late'));
  assert.equal(lifecycle.state.results.randomDistribution, undefined);
  assert.equal(lifecycle.state.results.modifierContributionsError, '');
});

test('chart enrichment preserves baseline identity and completed analyses', () => {
  const f = analysisFixture();
  const baseline = f.publish({ dps: 10, steps: [{ activationId: 'editor' }] });
  f.lifecycle.runDistribution();
  f.work.distribution.at(-1).complete({ trials: 2, mean: 12 });
  f.showAnalysis();
  const chart = f.work.baseline.at(-1);
  chart.complete({ result: { dps: 999, effectReport: { charts: true }, boonGeneration: {} } });
  assert.equal(f.lifecycle.state.results, baseline);
  assert.equal(baseline.dps, 10);
  assert.equal(baseline.steps[0].activationId, 'editor');
  assert.equal(baseline.randomDistribution.mean, 12);
  assert.equal(baseline.effectReport.charts, true);
  f.work.modifiers.at(-1).complete([{ id: 'finished' }]);
  const counts = [f.work.baseline.length, f.work.modifiers.length];
  f.showAnalysis(false);
  f.showAnalysis();
  assert.deepEqual([f.work.baseline.length, f.work.modifiers.length], counts);
});

test('leaving Analysis abandons enrichment but preserves editor work and resumes a dual-patch edit', () => {
  const f = analysisFixture();
  f.publish({ dps: 10 });
  f.showAnalysis();
  const abandoned = f.work.baseline.at(-1);
  f.showAnalysis(false);
  abandoned.complete({ result: { effectReport: { obsolete: true } } });
  assert.equal(f.lifecycle.state.results.effectReport, undefined);
  assert.equal(f.lifecycle.state.simulationStatus, 'idle');
  f.inputs.identity.previewId = 'preview';
  f.showAnalysis();
  f.lifecycle.changeInputs();
  f.lifecycle.refreshBaseline();
  const dual = f.work.baseline.at(-1);
  assert.ok(dual.request.comparisonConfig);
  f.showAnalysis(false);
  const editor = f.work.baseline.at(-1);
  assert.notEqual(editor, dual);
  assert.equal(editor.request.comparisonConfig, undefined);
  dual.fail('late');
  const cancellationCount = f.cancellations.filter((kind) => kind === 'baseline').length;
  f.showAnalysis(false);
  assert.equal(f.cancellations.filter((kind) => kind === 'baseline').length, cancellationCount);
  editor.complete({ result: { dps: 20 } });
  assert.equal(f.lifecycle.state.results.dps, 20);
});

test('chart failures permit modifier work while modifier failures clear carried values', () => {
  const f = analysisFixture();
  f.publish({ dps: 10, contributions: [{ id: 'carried' }] });
  f.showAnalysis();
  f.work.baseline.at(-1).fail(new Error('charts unavailable'));
  assert.equal(f.lifecycle.state.simulationStatus, 'error');
  assert.equal(f.lifecycle.state.simulationError, 'charts unavailable');
  assert.equal(f.work.modifiers.length, 1);
  f.work.modifiers[0].fail(new Error('modifier unavailable'));
  assert.equal(f.lifecycle.state.results.contributions, undefined);
  assert.equal(f.lifecycle.state.results.modifierContributionsStale, false);
  assert.equal(f.lifecycle.state.results.modifierContributionsError, 'modifier unavailable');
});

test('RNG availability is cheap; explicit sampling owns progress, waiting, and errors', () => {
  let prepared = 0;
  const f = analysisFixture({
    distributionRequest: () => {
      prepared++;
      return { rotation: [], baseConfig: {}, trials: 2 };
    }
  });
  f.publish({ dps: 10, effectReport: {} });
  assert.equal(prepared, 0);
  assert.equal(f.lifecycle.state.results.randomDistributionRequested, true);
  f.showAnalysis();
  const modifier = f.work.modifiers[0];
  assert.equal(modifier.ready(), true);
  f.lifecycle.runDistribution();
  assert.equal(prepared, 1);
  assert.equal(modifier.ready(), false);
  const first = f.work.distribution[0];
  first.progress({ completed: 1, total: 2, percent: 50 });
  assert.equal(f.lifecycle.state.results.randomDistributionProgress.percent, 50);
  f.lifecycle.runDistribution();
  first.complete({ trials: 2, mean: 999 });
  assert.equal(f.lifecycle.state.results.randomDistribution, undefined);
  f.work.distribution[1].fail(new Error('sampling failed'));
  assert.equal(f.lifecycle.state.results.randomDistributionError, 'sampling failed');
  assert.equal(modifier.ready(), true);
});

test('restoring a tab rejects outgoing callbacks and reuses data without restoring old request identity', () => {
  const f = analysisFixture();
  const saved = f.publish({ dps: 10, effectReport: {} });
  const snapshot = f.lifecycle.capture();
  f.lifecycle.runDistribution();
  const outgoing = f.work.distribution[0];
  f.lifecycle.changeInputs();
  f.publish({ dps: 20 });
  const revision = f.lifecycle.state.buildRevision;
  f.lifecycle.restore(snapshot);
  assert.equal(f.lifecycle.state.results, saved);
  assert.ok(f.lifecycle.state.buildRevision > revision);
  assert.equal(f.lifecycle.state.resultRevision, f.lifecycle.state.buildRevision);
  outgoing.fail('old tab');
  assert.equal(saved.randomDistributionError, '');
  f.inputs.identity.damageDiagnostics = true;
  f.lifecycle.restore(snapshot);
  assert.equal(f.lifecycle.state.results, null);
  assert.equal(f.lifecycle.state.resultRevision, -1);
  f.lifecycle.resume();
  assert.equal(f.lifecycle.state.simulationStatus, 'queued');
});

test('reference adoption marks matching Current fresh while replacement work is queued', () => {
  const f = analysisFixture();
  f.publish({ dps: 10 });
  const reference = { dps: 20 };
  f.lifecycle.changeInputs(false, reference);
  assert.equal(f.lifecycle.state.results, reference);
  assert.equal(f.lifecycle.state.resultRevision, f.lifecycle.state.buildRevision);
  assert.equal(f.lifecycle.state.simulationStatus, 'queued');
  assert.equal(f.lifecycle.capture().fresh, false);
});

test('cancellation invalidates callbacks before an execution adapter can call back synchronously', () => {
  const f = analysisFixture();
  const result = f.publish({ dps: 10, effectReport: {} });
  f.showAnalysis();
  f.lifecycle.runDistribution();
  f.lifecycle.refreshBaseline();
  const old = f.work.baseline.at(-1);
  f.execution.baseline.cancel = () => {
    old.complete({ result: { dps: 999 } });
    f.work.modifiers[0].complete([{ id: 'obsolete' }]);
    f.work.distribution[0].complete({ trials: 2, mean: 999 });
  };

  f.lifecycle.suspend();
  assert.equal(f.lifecycle.state.results, result);
  assert.equal(result.contributions, undefined);
  assert.equal(result.randomDistribution, undefined);
});

test('same-revision baseline replacement rejects outcomes belonging to the replaced result', () => {
  const f = analysisFixture();
  f.publish({ dps: 10, effectReport: {} });
  f.showAnalysis();
  const oldModifier = f.work.modifiers[0];
  f.lifecycle.runDistribution();
  const oldDistribution = f.work.distribution[0];
  const replacement = f.publish({ dps: 20, effectReport: {} });
  oldModifier.complete([{ id: 'obsolete' }]);
  oldDistribution.progress({ completed: 2, total: 2, percent: 100 });
  oldDistribution.fail(new Error('obsolete'));
  assert.equal(f.lifecycle.state.results, replacement);
  assert.equal(replacement.contributions, undefined);
  assert.equal(replacement.randomDistributionProgress.percent, 0);
  assert.equal(replacement.randomDistributionError, '');
});

test('restoration resumes interrupted sampling and retains completed sampling without relaunching', () => {
  const f = analysisFixture();
  const result = f.publish({ dps: 10, effectReport: {} });
  f.lifecycle.runDistribution();
  const snapshot = f.lifecycle.capture();
  const interrupted = f.work.distribution[0];
  f.lifecycle.suspend();
  f.lifecycle.restore(snapshot);
  const renders = f.changes.filter(({ kind }) => kind === 'distribution').length;
  f.lifecycle.resume();
  assert.equal(f.work.distribution.length, 2);
  assert.equal(f.changes.filter(({ kind }) => kind === 'distribution').length, renders);
  interrupted.complete({ trials: 2, mean: 999 });
  assert.equal(result.randomDistribution, undefined);
  f.work.distribution[1].complete({ trials: 2, mean: 12 });
  f.lifecycle.restore(f.lifecycle.capture());
  f.lifecycle.resume();
  assert.equal(f.work.distribution.length, 2);
  assert.equal(f.lifecycle.state.results, result);
  assert.equal(result.randomDistribution.mean, 12);
});

test('canonical state is read-only and synchronous initialization uses the same publication owner', () => {
  const f = analysisFixture();
  f.lifecycle.initialize();
  assert.equal(f.lifecycle.state.results.dps, 10);
  assert.equal(f.work.baseline.length, 0);
  assert.throws(() => {
    f.lifecycle.state.resultRevision = 999;
  }, TypeError);
  assert.equal(f.changes.find((change) => change.kind === 'baseline').render, false);
});
