/** Snapshot contracts exercise the production input seam without browser state or workers. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { createBossScenario } from '#gw2/app/boss-scenarios/model.js';
import { captureAnalysisRequestSnapshot } from '#gw2/app/simulation/analysis-request-snapshot.js';
import { mesmerAppAdapter } from '#gw2/professions/mesmer/app/app-definition.js';
import { analysisFixture } from '#tests/helpers/analysis-lifecycle.js';

const editorIntent = { collectChartData: false, comparePatch: false };

function fixture() {
  const build = mesmerAppAdapter.toApplicationBuild(mesmerAppAdapter.profession.createBuildDefaults());
  build.rotation = [{ type: 'wait', durationMs: 1000 }];
  build.assumptions.might = 25;
  const input = {
    build,
    patch: { id: 'current', values: {} },
    simulationSettings: { transitionDelays: { weaponSwapMs: 100 } },
    damageDiagnostics: false
  };
  let prepared = 0;
  const capture = () =>
    captureAnalysisRequestSnapshot(input, {
      profession: mesmerAppAdapter.profession,
      createBuildContext: (context) => {
        prepared++;
        return mesmerAppAdapter.createBuildContext(context);
      }
    });
  return { input, capture, prepared: () => prepared };
}

test('capture is lazy and detached from nested edits, replaced rotations, settings, and patch values', () => {
  const f = fixture();
  const snapshot = f.capture();
  assert.equal(f.prepared(), 0);
  assert.equal(snapshot.identity.build, f.input.build, 'cache owner remains the original opaque build object');
  const expected = snapshot.baseline(editorIntent);
  const key = snapshot.identity.builds.current;
  f.input.build.rotation[0].durationMs = 9000;
  f.input.build.rotation.push({ type: 'combat-start' });
  f.input.build.rotation = [];
  f.input.build.assumptions.might = 0;
  f.input.build.selectedSkillIds.Utility1 = null;
  f.input.simulationSettings.transitionDelays.weaponSwapMs = 900;
  f.input.patch.values.changed = 99;
  f.input.patch.id = 'unavailable';
  assert.equal(snapshot.identity.builds.current, key);
  assert.equal(snapshot.identity.values, '{}');
  assert.deepEqual(snapshot.baseline(editorIntent), expected);
  const modifiers = snapshot.modifiers(100);
  assert.ok(modifiers.comparisons.some(({ modifier }) => modifier.id === 'Boon:Might'));
  assert.deepEqual(modifiers.rotation, expected.rotation);
  assert.equal(snapshot.distribution().baseConfig.transitionDelays.weaponSwapMs, 100);
  assert.deepEqual(snapshot.distribution().rotation, expected.rotation);
});

test('prepared payloads and reference commands cannot mutate later preparations', () => {
  const f = fixture();
  const snapshot = f.capture();
  const reference = [{ type: 'wait', durationMs: 2000 }];
  const request = snapshot.baseline({ ...editorIntent, referenceRotation: reference });
  const original = snapshot.baseline(editorIntent);
  reference[0].durationMs = 9000;
  assert.equal(request.referenceRotation[0].durationMs, 2000);
  request.rotation[0].durationMs = 9999;
  request.baseConfig.transitionDelays.weaponSwapMs = 999;
  assert.deepEqual(snapshot.baseline(editorIntent), original);
  const referenceSnapshot = snapshot.withRotation(reference);
  reference[0].durationMs = 3000;
  assert.equal(referenceSnapshot.baseline(editorIntent).rotation[0].durationMs, 9000);
  assert.equal(snapshot.baseline(editorIntent).rotation[0].durationMs, 1000);
  assert.doesNotThrow(() => structuredClone(snapshot.modifiers(100)));
  assert.doesNotThrow(() => structuredClone(snapshot.distribution()));
});

test('baseline, modifiers, and stochastic sampling share captured encounter assumptions', () => {
  const f = fixture();
  f.input.scenario = createBossScenario('020102', f.input.build, 'Snapshot scenario', 'current');
  f.input.scenario.phases[0].groupDps = 123456;
  const snapshot = f.capture();
  assert.equal(f.prepared(), 0);
  const baseline = snapshot.baseline({ ...editorIntent, comparePatch: true });
  f.input.scenario.phases[0].groupDps = 999999;
  f.input.scenario.phases.length = 0;
  assert.equal(baseline.comparisonConfig, undefined);
  assert.equal(snapshot.identity.scenario, true);
  assert.equal(baseline.baseConfig.randomness.mode, 'deterministic');
  const rng = snapshot.distribution();
  assert.equal(rng.baseConfig.randomness.mode, 'stochastic');
  assert.equal(rng.baseConfig.randomness.seed, baseline.baseConfig.randomness.seed);
  for (const config of [rng.baseConfig, ...snapshot.modifiers(100).comparisons.map(({ config }) => config)]) {
    assert.deepEqual(config.encounter, baseline.baseConfig.encounter);
    for (const key of ['armor', 'health', 'startingHealthFraction', 'defiant']) {
      assert.equal(config.target[key], baseline.baseConfig.target[key]);
    }

    assert.equal(config.allies.count, 4);
    assert.equal(config.sharePlayerBoonsWithSummons, false);
  }
});

test('modifier candidates derive from captured traits without presentation attributes', () => {
  const f = fixture();
  const snapshot = f.capture();
  const expected = mesmerAppAdapter
    .createBuildContext({
      build: f.input.build,
      patch: mesmerAppAdapter.profession.resolvePatch(f.input.patch),
      transitionDelays: snapshot.baseline(editorIntent).baseConfig.transitionDelays
    })
    .attributes(1)
    .activeTraits.map(({ name }) => `Trait:${name}`);
  assert.ok(expected.length > 0);
  f.input.build.specializations = [];
  assert.deepEqual(
    snapshot
      .modifiers(100)
      .comparisons.filter(({ modifier }) => modifier.type === 'Trait')
      .map(({ modifier }) => modifier.id),
    expected
  );
});

test('lifecycle enrichment and restored sampling prepare against their baseline capture', () => {
  const f = fixture();
  const lifecycle = analysisFixture({ captureInputs: f.capture });
  const result = lifecycle.publish({ dps: 10 });
  const saved = lifecycle.lifecycle.capture();
  const capturedRequests = f.prepared();
  assert.equal(capturedRequests, 1, 'baseline availability never prepares optional requests');
  f.input.build.rotation[0].durationMs = 9999;
  f.input.build.assumptions.might = 0;
  lifecycle.showAnalysis();
  const charts = lifecycle.work.baseline.at(-1);
  assert.equal(charts.request.rotation[0].durationMs, 1000);
  charts.complete({ result: { effectReport: {}, boonGeneration: {} } });
  const modifier = lifecycle.work.modifiers.at(-1);
  assert.equal(modifier.request.rotation[0].durationMs, 1000);
  assert.ok(modifier.request.comparisons.some(({ modifier }) => modifier.id === 'Boon:Might'));
  lifecycle.lifecycle.restore(saved);
  lifecycle.lifecycle.runDistribution();
  assert.equal(lifecycle.lifecycle.state.results, result);
  assert.equal(lifecycle.work.distribution.at(-1).request.rotation[0].durationMs, 1000);
});

test('request intent controls charts and opposite-patch preparation without consulting the DOM', () => {
  const f = fixture();
  const snapshot = f.capture();
  assert.ok(snapshot.identity.previewId, 'fixture must exercise opposite-patch capture');
  const baseline = snapshot.baseline(editorIntent);
  assert.equal(baseline.collectChartData, false);
  assert.equal(baseline.comparisonConfig, undefined);
  const charts = snapshot.baseline({ collectChartData: true, comparePatch: true });
  assert.equal(charts.collectChartData, true);

  if (snapshot.identity.previewId) {
    assert.equal(charts.comparisonConfig.patchId, snapshot.identity.previewId);
    f.input.patch.id = snapshot.identity.previewId;
    const opposite = f.capture();
    assert.deepEqual(opposite.baseline(editorIntent).baseConfig, charts.comparisonConfig);
    assert.equal(
      opposite.identity.builds[opposite.identity.selectedPatchId],
      snapshot.identity.builds[snapshot.identity.previewId]
    );
  }
});

test('a pinned reference carries its own captured rotation when adopted as Current', () => {
  const f = fixture();
  const referenceRotation = [{ type: 'wait', durationMs: 2000 }];
  const lifecycle = analysisFixture({
    captureInputs: f.capture,
    context: () => ({
      build: f.input.build,
      damageDiagnostics: false,
      referenceRotation,
      referenceQueued: true
    })
  });
  lifecycle.lifecycle.refreshBaseline();
  const operation = lifecycle.work.baseline.at(-1);
  referenceRotation[0].durationMs = 9000;
  assert.equal(operation.request.referenceRotation[0].durationMs, 2000);
  const referenceResult = { dps: 20 };
  operation.complete({ result: { dps: 10 }, referenceResult });
  lifecycle.lifecycle.changeInputs(false, referenceResult);
  lifecycle.lifecycle.runDistribution();
  assert.equal(lifecycle.lifecycle.state.results, referenceResult);
  assert.equal(lifecycle.work.distribution.at(-1).request.rotation[0].durationMs, 2000);
});

test('reusing Current after a tuned preview keeps its baseline but compares the newly selected tuning', () => {
  const catalog = { skills: [], skillsById: new Map() };
  const profession = {
    id: 'fixture',
    preview: { id: 'preview' },
    resolvePatch: ({ id, values }) => ({ id, values, catalog }),
    runtimeFor: () => ({ catalog, calculations: {} })
  };
  const input = {
    build: { rotation: [{ type: 'wait', durationMs: 1000 }], selectedSkillIds: {}, assumptions: {} },
    patch: { id: 'preview', values: { tuning: 2 } }
  };
  const capture = () =>
    captureAnalysisRequestSnapshot(input, {
      profession,
      createBuildContext: ({ patch }) => ({
        attributes: () => ({ activeTraits: [] }),
        simulationConfig: () => ({ patchId: patch.id, previewValues: { ...patch.values } })
      })
    });
  const f = analysisFixture({
    context: () => ({ build: input.build, damageDiagnostics: false, referenceQueued: false, referenceRotation: null }),
    captureInputs: capture
  });
  f.showAnalysis();
  f.lifecycle.refreshBaseline();
  const current = { dps: 10 };
  f.work.baseline
    .at(-1)
    .complete({ result: { dps: 20, effectReport: {} }, comparisonResult: { patchId: 'current', result: current } });
  f.showAnalysis(false);
  input.patch = { id: 'current', values: {} };
  f.lifecycle.changeInputs(true);
  const previousWork = f.work.baseline.length;
  f.lifecycle.refreshBaseline();
  assert.equal(f.work.baseline.length, previousWork);
  assert.equal(f.lifecycle.state.results, current);
  f.showAnalysis();
  const request = f.work.baseline.at(-1).request;
  assert.equal(request.comparisonConfig.patchId, 'preview');
  assert.deepEqual(request.comparisonConfig.previewValues, {});
});
