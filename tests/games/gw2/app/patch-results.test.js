/** Patch reuse is exercised through the lifecycle that owns cache admission and result publication. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { analysisFixture } from '#tests/helpers/analysis-lifecycle.js';

function fixture() {
  const f = analysisFixture();
  f.inputs.identity.previewId = 'preview';
  f.switchPatch = (id) => {
    f.inputs.identity.selectedPatchId = id;
    f.lifecycle.changeInputs(true);
  };

  return f;
}

test('comparison requires both versions and ordinary edits invalidate both', () => {
  const f = fixture();
  const live = f.publish({ dps: 10 });
  assert.equal(f.lifecycle.needsPatchComparison(f.execution.captureInputs()), true);
  f.switchPatch('preview');
  assert.equal(f.lifecycle.needsPatchComparison(f.execution.captureInputs()), false);
  const preview = f.publish({ dps: 20 });
  assert.deepEqual(f.lifecycle.state.patchComparison, { current: live, preview });
  f.lifecycle.changeInputs();
  assert.equal(f.lifecycle.state.patchComparison, null);
  assert.equal(f.lifecycle.needsPatchComparison(f.execution.captureInputs()), true);
  f.publish({ dps: 30 });
  f.switchPatch('current');
  f.publish({ dps: 40 });
  assert.equal(f.lifecycle.state.patchComparison.preview.dps, 30);
});

test('cache validates build identity, selections, settings, diagnostics, and preview values', () => {
  for (const change of [
    (identity) => {
      identity.build = {};
    },
    (identity) => {
      identity.builds.current = 'different selection';
    },
    (identity) => {
      identity.environment = 'different settings';
    },
    (identity) => {
      identity.damageDiagnostics = true;
    }
  ]) {
    const f = fixture();
    f.publish({ dps: 10 });
    change(f.inputs.identity);
    const before = f.work.baseline.length;
    f.lifecycle.refreshBaseline();
    assert.equal(f.work.baseline.length, before + 1);
  }

  const f = fixture();
  f.switchPatch('preview');
  f.inputs.identity.values = '{"charges":3}';
  f.publish({ dps: 20 });
  f.switchPatch('current');
  f.inputs.identity.values = '{}';
  f.publish({ dps: 10 });
  assert.equal(f.lifecycle.state.patchComparison, null);
  f.switchPatch('preview');
  f.publish({ dps: 30 });
  assert.equal(f.lifecycle.state.patchComparison.preview.dps, 30);
});

test('validated return visits preserve baseline identity and completed analyses', () => {
  const f = fixture();
  const live = f.publish({ dps: 10, effectReport: {} });
  f.showAnalysis();
  f.work.baseline
    .at(-1)
    .complete({ result: { effectReport: {} }, comparisonResult: { patchId: 'preview', result: { dps: 20 } } });
  f.work.modifiers.at(-1).complete([{ id: 'complete' }]);
  f.lifecycle.runDistribution();
  f.work.distribution.at(-1).complete({ trials: 2, mean: 11 });
  f.showAnalysis(false);
  f.switchPatch('preview');
  f.lifecycle.refreshBaseline();
  const before = [f.work.baseline.length, f.work.modifiers.length, f.work.distribution.length];
  f.switchPatch('current');
  f.lifecycle.refreshBaseline();
  f.showAnalysis();
  assert.equal(f.lifecycle.state.results, live);
  assert.equal(live.contributions[0].id, 'complete');
  assert.equal(live.randomDistribution.mean, 11);
  assert.deepEqual([f.work.baseline.length, f.work.modifiers.length, f.work.distribution.length], before);
});

test('obsolete publication cannot populate the newly selected patch cache', () => {
  const f = fixture();
  f.lifecycle.refreshBaseline();
  const old = f.work.baseline.at(-1);
  f.switchPatch('preview');
  old.complete({ result: { dps: 999 } });
  f.publish({ dps: 20 });
  assert.equal(f.lifecycle.state.patchComparison, null);
  assert.equal(f.lifecycle.needsPatchComparison(f.execution.captureInputs()), true);
});

test('Boss scenarios neither populate nor reuse Golem patch comparisons', () => {
  const f = fixture();
  f.publish({ dps: 10 });
  f.inputs.identity.scenario = true;
  f.switchPatch('preview');
  f.publish({ dps: 20 });
  assert.equal(f.lifecycle.state.patchComparison, null);
  assert.equal(f.lifecycle.needsPatchComparison(f.execution.captureInputs()), false);
  const before = f.work.baseline.length;
  f.lifecycle.refreshBaseline();
  assert.equal(f.work.baseline.length, before + 1);
});
