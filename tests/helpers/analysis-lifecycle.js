/** Drives the production lifecycle through controlled execution, without browser globals or private-state mutation. */
import { AnalysisResultLifecycle } from '#gw2/app/simulation/analysis-result-lifecycle.js';

export function analysisFixture(overrides = {}) {
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
  let visible = false;
  const request = () => ({
    rotation: inputs.rotationLength ? [{ type: 'wait', durationMs: 1 }] : [],
    baseConfig: {},
    selectedPatchId: inputs.identity.selectedPatchId,
    ...(visible && lifecycle.needsPatchComparison()
      ? { comparisonConfig: { patchId: inputs.identity.selectedPatchId === 'current' ? 'preview' : 'current' } }
      : {})
  });
  const execution = {
    inputs: () => inputs,
    baselineRequest: request,
    modifierRequest: (baselineDps) => ({ rotation: [], baselineDps, comparisons: [] }),
    distributionRequest: () => ({ rotation: [], baseConfig: {}, trials: 2 }),
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
      visible = value;
      lifecycle.setAnalysisVisible(value);
    },
    publish(result) {
      lifecycle.refreshBaseline();
      work.baseline.at(-1)?.complete({ result });
      return result;
    }
  };
}
