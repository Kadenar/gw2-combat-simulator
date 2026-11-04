/** Defines selected-patch baseline requests and results. */
import type { GameContentAddress } from '#browser/game/contracts.js';
import type { RotationCommand } from '#gw2/platform/builds/rotation.js';
import type { Gw2SimulationResult } from '#gw2/platform/results/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

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
  /** Analysis may request the missing opposite-patch result; Workspace never includes this configuration. */
  readonly comparisonConfig?: Gw2Config & { readonly patchId: string };
}

/** Selected-patch output, with an opposite-patch result only when explicitly requested by Analysis. */
export interface BaselineSimulationOutput {
  readonly result: BaselineSimulationResult;
  readonly comparisonResult?: { readonly patchId: string; readonly result: BaselineSimulationResult };
  readonly referenceResult?: BaselineSimulationResult;
}
