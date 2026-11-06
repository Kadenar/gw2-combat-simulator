/** Drives the production lifecycle through controlled execution, without browser globals or private-state mutation. */
import { AnalysisResultLifecycle } from '#gw2/app/simulation/analysis-result-lifecycle.js';

export function analysisFixture({ snapshot: preparation, ...overrides } = {}) {
  const inputs = {
    rotationLength: 1,
    referenceQueued: false,
    identity: {
      build: {},
      selectedPatchId: 'current',
      previewId: null,
      environment: 'settings',
      values: '{}',
      builds: { current: 'build', preview: 'build' },
      damageDiagnostics: false,
      scenario: false
    }
  };
  const work = { baseline: [], modifiers: [], distribution: [] };
  const cancellations = [];
  const changes = [];
  const execution = {
    context: () => ({
      build: inputs.identity.build,
      damageDiagnostics: inputs.identity.damageDiagnostics,
      referenceQueued: inputs.referenceQueued,
      referenceRotation: inputs.referenceRotation ?? null
    }),
    captureInputs: () => controlledAnalysisSnapshot(inputs, preparation),
    calculateBaseline: () => ({ result: { dps: 10 } }),
    changed: (change) => changes.push(change),
    ...Object.fromEntries(
      Object.keys(work).map((kind) => [
        kind,
        {
          run: (operation) => work[kind].push(operation),
          cancel: () => cancellations.push(kind)
        }
      ])
    ),
    ...overrides
  };
  const lifecycle = new AnalysisResultLifecycle(execution);
  return {
    lifecycle,
    inputs,
    work,
    changes,
    cancellations,
    execution,
    showAnalysis(value = true) {
      lifecycle.setAnalysisVisible(value);
    },
    publish(result) {
      lifecycle.refreshBaseline();
      work.baseline.at(-1)?.complete({ result });
      return result;
    }
  };
}

/** Controlled request preparation isolates lifecycle contracts from profession formulas. */
export function controlledAnalysisSnapshot(inputs, preparation = {}) {
  const identity = { ...structuredClone({ ...inputs.identity, build: null }), build: inputs.identity.build };
  const rotation = inputs.rotation ?? (inputs.rotationLength ? [{ type: 'wait', durationMs: 1 }] : []);
  const captured = structuredClone(rotation);
  return {
    identity,
    rotationLength: captured.length,
    baseline: (intent) => ({
      rotation: structuredClone(captured),
      baseConfig: {},
      selectedPatchId: identity.selectedPatchId,
      collectChartData: intent.collectChartData,
      ...(intent.referenceRotation ? { referenceRotation: structuredClone(intent.referenceRotation) } : {}),
      ...(intent.comparePatch && identity.previewId && !identity.scenario
        ? { comparisonConfig: { patchId: identity.selectedPatchId === 'current' ? identity.previewId : 'current' } }
        : {})
    }),
    modifiers: (baselineDps) => ({ rotation: structuredClone(captured), baselineDps, comparisons: [] }),
    distribution: () => ({ rotation: structuredClone(captured), baseConfig: {}, trials: 2 }),
    withRotation: (rotation) => controlledAnalysisSnapshot({ ...inputs, rotation, identity }, preparation),
    ...preparation
  };
}
