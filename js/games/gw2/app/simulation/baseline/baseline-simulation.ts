import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import type { Gw2ProfessionSource } from '#gw2/platform/profession-definition/family-contract.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { RotationCommand } from '#gw2/platform/builds/rotation.js';
import type {
  BaselineSimulationOutput,
  BaselineSimulationRequest,
  BaselineSimulationResult
} from '#gw2/app/simulation/baseline/types.js';

/** Runs serialized baselines using only engine inputs, without loading the browser editor in workers. */
export function calculateBaselineSimulation(
  request: BaselineSimulationRequest,
  profession: Gw2ProfessionSource
): BaselineSimulationOutput {
  const simulateBuild = (rotation: readonly RotationCommand[], config: Gw2Config): BaselineSimulationResult => {
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
      collectChartData: request.collectChartData
    });
    return debugInputs ? { ...result, debugInputs } : result;
  };

  const { rotation, referenceRotation, baseConfig, selectedPatchId, patchConfigs } = request;

  if (!patchConfigs) {
    return {
      result: simulateBuild(rotation, baseConfig),
      patchComparison: null,
      ...(referenceRotation ? { referenceResult: simulateBuild(referenceRotation, baseConfig) } : null)
    };
  }

  const previewPatchId = patchConfigs.preview.patchId!;
  const current = simulateBuild(rotation, patchConfigs.current);
  const preview = simulateBuild(rotation, patchConfigs.preview);
  return {
    result: selectedPatchId === previewPatchId ? preview : current,
    patchComparison: { current, preview },
    // Reference uses only the selected patch; patch comparison remains a Current-only analysis.
    ...(referenceRotation ? { referenceResult: simulateBuild(referenceRotation, baseConfig) } : null)
  };
}
