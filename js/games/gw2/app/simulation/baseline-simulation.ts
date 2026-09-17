import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import type { Gw2ProfessionSource } from '#gw2/platform/simulation/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { RotationCommand } from '#gw2/platform/engine/execution/types.js';
import type {
  BaselineSimulationOutput,
  BaselineSimulationRequest,
  CombatPreviewSimulationRequest
} from '#gw2/app/simulation/types.js';
import type { CombatPreviewOutcome } from '#gw2/platform/simulation/combat-engine-adapter/result.js';
import type { CombatPrefixOutcome } from '#gw2/platform/simulation/combat-engine-adapter/prefix.js';

/** Runs serialized baselines using only engine inputs, without loading the browser editor in workers. */
export function calculateBaselineSimulation(
  request: CombatPreviewSimulationRequest,
  profession: Gw2ProfessionSource
): CombatPreviewOutcome | CombatPrefixOutcome;
export function calculateBaselineSimulation(
  request: BaselineSimulationRequest,
  profession: Gw2ProfessionSource
): BaselineSimulationOutput;
export function calculateBaselineSimulation(
  request: BaselineSimulationRequest | CombatPreviewSimulationRequest,
  profession: Gw2ProfessionSource
): BaselineSimulationOutput | CombatPreviewOutcome | CombatPrefixOutcome;
export function calculateBaselineSimulation(
  request: BaselineSimulationRequest | CombatPreviewSimulationRequest,
  profession: Gw2ProfessionSource
): BaselineSimulationOutput | CombatPreviewOutcome | CombatPrefixOutcome {
  // The same serialized request can execute in Node or a worker; no preview-to-legacy retry exists.
  if (request.selection?.engine === 'preview')
    return simulateGw2({ ...(request as CombatPreviewSimulationRequest), profession });
  const legacy = request as BaselineSimulationRequest;
  const simulateBuild = (rotation: readonly RotationCommand[], config: Gw2Config) =>
    simulateGw2({ profession, rotation, config, selection: legacy.selection });
  const { rotation, referenceRotation, baseConfig, selectedPatchId, previewPatchId } = legacy;
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
