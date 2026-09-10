import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import type { Gw2ProfessionSource } from '#gw2/platform/simulation/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { RotationCommand } from '#gw2/platform/engine/execution/types.js';
import type { BaselineSimulationOutput, BaselineSimulationRequest } from '#gw2/app/simulation/types.js';

/** Runs serialized baselines using only engine inputs, without loading the browser editor in workers. */
export function calculateBaselineSimulation(
  request: BaselineSimulationRequest,
  profession: Gw2ProfessionSource
): BaselineSimulationOutput {
  const simulateBuild = (rotation: readonly RotationCommand[], config: Gw2Config) =>
    simulateGw2({ profession, rotation, config });
  const { rotation, referenceRotation, baseConfig, selectedPatchId, previewPatchId } = request;
  if (!previewPatchId) {
    return {
      result: simulateBuild(rotation, baseConfig),
      patchComparison: null,
      ...(referenceRotation ? { referenceResult: simulateBuild(referenceRotation, baseConfig) } : null)
    };
  }

  const configForPatch = (patchId: string): Gw2Config => ({ ...baseConfig, patchId });
  const current = simulateBuild(rotation, configForPatch('current'));
  const preview = simulateBuild(rotation, configForPatch(previewPatchId));
  return {
    result: selectedPatchId === previewPatchId ? preview : current,
    patchComparison: { patchId: previewPatchId, current, preview },
    // Reference uses only the selected patch; patch comparison remains a Current-only analysis.
    ...(referenceRotation
      ? { referenceResult: simulateBuild(referenceRotation, configForPatch(selectedPatchId)) }
      : null)
  };
}
