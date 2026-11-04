import type {
  BaselineSimulationOutput,
  BaselineSimulationRequest,
  BaselineSimulationResult
} from '#gw2/app/simulation/baseline/types.js';
import type { RotationCommand } from '#gw2/platform/builds/rotation.js';
import type { Gw2ProfessionSource } from '#gw2/platform/profession-definition/family-contract.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

/** Runs the selected version and only explicitly requested Analysis comparisons, without browser editor dependencies. */
export function calculateBaselineSimulation(
  request: BaselineSimulationRequest,
  profession: Gw2ProfessionSource
): BaselineSimulationOutput {
  const simulateBuild = (
    rotation: readonly RotationCommand[],
    config: Gw2Config,
    collectChartData = request.collectChartData
  ): BaselineSimulationResult => {
    // Snapshot the exact run inputs only when requested; ordinary baselines retain no debug payload.
    const debugInputs = request.damageDiagnostics
      ? structuredClone({
          gameId: request.gameId,
          contentId: request.contentId,
          rotation,
          config,
          patchId: config.patchId ?? request.selectedPatchId,
          observationPolicy: { kind: 'rotation' as const },
          damageDiagnostics: true as const
        })
      : undefined;
    const result = simulateGw2({
      profession,
      rotation,
      config,
      damageDiagnostics: request.damageDiagnostics,
      collectChartData
    });
    return debugInputs ? { ...result, debugInputs } : result;
  };

  const { rotation, referenceRotation, baseConfig, comparisonConfig } = request;
  return {
    result: simulateBuild(rotation, baseConfig),
    ...(comparisonConfig
      ? {
          comparisonResult: {
            patchId: comparisonConfig.patchId,
            // The comparison panel consumes damage events and totals, never effect-history charts.
            result: simulateBuild(rotation, comparisonConfig, false)
          }
        }
      : null),
    ...(referenceRotation ? { referenceResult: simulateBuild(referenceRotation, baseConfig) } : null)
  };
}
