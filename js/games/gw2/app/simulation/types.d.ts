/** Defines baseline requests and results, including optional patch comparisons. */
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { GameContentAddress } from '#app/shell/types.js';
import type { RotationCommand } from '#gw2/platform/engine/execution/types.js';
import type { Gw2SimulationResult, Gw2SimulationViewResult } from '#gw2/platform/simulation/types.js';
import type { CombatPreviewInput } from '#gw2/platform/simulation/combat-engine-adapter/input.js';

export interface PatchComparison {
  readonly patchId: string;
  readonly current: Gw2SimulationResult;
  readonly preview: Gw2SimulationResult;
}

/** Serializable input sent to the dedicated baseline-simulation worker. */
export interface BaselineSimulationRequest extends GameContentAddress {
  readonly selection?: { readonly engine: 'legacy' };
  readonly rotation: readonly RotationCommand[];
  readonly referenceRotation?: readonly RotationCommand[];
  readonly baseConfig: Gw2Config;
  readonly selectedPatchId: string;
  readonly previewPatchId?: string;
}

/** Headless preview worker contract carries the selected build and content identity without changing saved data. */
export interface CombatPreviewSimulationRequest extends GameContentAddress, CombatPreviewInput {
  readonly output?: 'detailed' | 'score';
  readonly seed?: number;
}

/** Complete baseline output, including both sides of an optional patch preview. */
export interface BaselineSimulationOutput {
  readonly result: Gw2SimulationResult;
  readonly patchComparison: PatchComparison | null;
  readonly referenceResult?: Gw2SimulationResult;
}

/** Browser baselines can publish either engine's shared view, while headless legacy callers retain their full result. */
export type SelectedBaselineSimulationRequest = BaselineSimulationRequest | CombatPreviewSimulationRequest;
export type BaselineSimulationCalculation =
  | BaselineSimulationOutput
  | import('#gw2/platform/simulation/combat-engine-adapter/result.js').CombatPreviewOutcome
  | import('#gw2/platform/simulation/combat-engine-adapter/prefix.js').CombatPrefixOutcome;
export interface PublishedBaselineSimulationOutput extends Omit<BaselineSimulationOutput, 'result'> {
  readonly result: Gw2SimulationViewResult;
}
