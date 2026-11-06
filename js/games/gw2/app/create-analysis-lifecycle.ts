/** Captures browser-owned inputs and connects execution without exposing application state to lifecycle policy. */
import { AnalysisResultLifecycle, type AnalysisChange } from '#gw2/app/simulation/analysis-result-lifecycle.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

export function createAnalysisResultLifecycle(
  app: ProfessionAppState,
  changed: (change: AnalysisChange) => void
): AnalysisResultLifecycle {
  return new AnalysisResultLifecycle({
    context: () => ({
      build: app.build,
      damageDiagnostics: app.damageDiagnostics,
      referenceRotation: app.rotationComparison?.referenceRotation ?? null,
      referenceQueued: app.rotationComparison?.referenceStatus === 'queued'
    }),
    captureInputs: () =>
      app.adapter.captureAnalysis({
        build: app.build,
        patch: app.patch,
        simulationSettings: app.simulationSettings,
        scenario: app.workspace?.scenario,
        damageDiagnostics: app.damageDiagnostics
      }),
    calculateBaseline: (request) => app.adapter.calculateBaselineSimulation(request),
    baseline: {
      run: (operation) => app.baselineSimulationRunner.run(operation),
      cancel: () => app.baselineSimulationRunner.cancel()
    },
    modifiers: {
      run: (operation) => app.modifierContributionRunner.run(operation),
      cancel: () => app.modifierContributionRunner.cancel()
    },
    distribution: {
      run: (operation) => app.randomDistributionRunner.run(operation),
      cancel: () => app.randomDistributionRunner.cancel()
    },
    changed
  });
}
