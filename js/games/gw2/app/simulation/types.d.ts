/** Defines baseline requests and results, including optional patch comparisons. */
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { GameContentAddress } from '#app/shell/types.js';
import type { RotationCommand } from '#gw2/platform/engine/execution/types.js';
import type { Gw2SimulationResult } from '#gw2/platform/simulation/types.js';

export interface PatchComparison {
  readonly patchId: string;
  readonly current: Gw2SimulationResult;
  readonly preview: Gw2SimulationResult;
}

/** Serializable input sent to the dedicated baseline-simulation worker. */
export interface BaselineSimulationRequest extends GameContentAddress {
  readonly rotation: readonly RotationCommand[];
  readonly referenceRotation?: readonly RotationCommand[];
  readonly baseConfig: Gw2Config;
  readonly selectedPatchId: string;
  readonly previewPatchId?: string;
}

/** Complete baseline output, including both sides of an optional patch preview. */
export interface BaselineSimulationOutput {
  readonly result: Gw2SimulationResult;
  readonly patchComparison: PatchComparison | null;
  readonly referenceResult?: Gw2SimulationResult;
}
