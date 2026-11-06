/** Captures browser-owned inputs and connects execution without exposing application state to lifecycle policy. */
import { buildWithPatchSkillSelections } from '#gw2/app/build/state/skill-selection.js';
import { AnalysisResultLifecycle, type AnalysisChange } from '#gw2/app/simulation/analysis-result-lifecycle.js';
import type { ProfessionAppState } from '#gw2/app/types.js';

export function createAnalysisResultLifecycle(
  app: ProfessionAppState,
  changed: (change: AnalysisChange) => void
): AnalysisResultLifecycle {
  return new AnalysisResultLifecycle({
    inputs: () => {
      const previewId = app.profession.preview?.id ?? null;
      const patchIds = previewId ? ['current', previewId] : [app.patch.id];
      return {
        rotationLength: app.build.rotation.length,
        referenceQueued: app.rotationComparison?.referenceStatus === 'queued',
        identity: {
          build: app.build,
          selectedPatchId: app.patch.id,
          previewId,
          environment: JSON.stringify(app.simulationSettings),
          values: JSON.stringify(app.patch.values ?? {}),
          builds: Object.fromEntries(
            patchIds.map((id) => [
              id,
              JSON.stringify(
                id === app.patch.id
                  ? app.build
                  : buildWithPatchSkillSelections(app, app.profession.resolvePatch({ id }).catalog)
              )
            ])
          ),
          damageDiagnostics: app.damageDiagnostics,
          scenario: Boolean(app.workspace?.scenario)
        }
      };
    },
    baselineRequest: () => app.adapter.baselineSimulationRequest(app),
    modifierRequest: (dps) => app.adapter.modifierContributionRequest(app, dps),
    distributionRequest: () => app.adapter.randomDistributionRequest(app),
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
