/** Defines baseline requests and results, including optional patch comparisons. */
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { GameContentAddress } from '#browser/game/contracts.js';
import type { RotationCommand } from '#gw2/platform/execution/types.js';
import type { Gw2SimulationResult } from '#gw2/platform/results/types.js';

/** Captured inputs travel with their result, so exports never read a newer editor configuration. */
export interface BaselineDebugInputs extends GameContentAddress {
  readonly rotation: readonly RotationCommand[];
  readonly config: Gw2Config;
  readonly patchId: string;
  readonly observationPolicy: { readonly kind: 'rotation' };
  readonly damageDiagnostics: true;
}

export interface BaselineSimulationResult extends Gw2SimulationResult {
  readonly debugInputs?: BaselineDebugInputs;
}

export interface PatchComparison {
  readonly patchId: string;
  readonly current: BaselineSimulationResult;
  readonly preview: BaselineSimulationResult;
}

/** Serializable input sent to the dedicated baseline-simulation worker. */
export interface BaselineSimulationRequest extends GameContentAddress {
  /** Charts are collected only for visible Analysis; editor jobs still return APM and planning state. */
  readonly collectChartData?: boolean;
  /** Session-only capture applies to baseline results, never saved build assumptions or batch analysis. */
  readonly damageDiagnostics?: boolean;
  readonly rotation: readonly RotationCommand[];
  readonly referenceRotation?: readonly RotationCommand[];
  readonly baseConfig: Gw2Config;
  readonly selectedPatchId: string;
  readonly previewPatchId?: string;
}

/** Complete baseline output, including both sides of an optional patch preview. */
export interface BaselineSimulationOutput {
  readonly result: BaselineSimulationResult;
  readonly patchComparison: PatchComparison | null;
  readonly referenceResult?: BaselineSimulationResult;
}
