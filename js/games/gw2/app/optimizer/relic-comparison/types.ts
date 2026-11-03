/** Owns the relic-comparison contracts used by its runner, runtime adapter, and views. */
import type { RotationCommand } from '#gw2/platform/builds/rotation.js';
import type { Gw2SimulationResult } from '#gw2/platform/results/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

export interface RelicComparisonRequest {
  readonly rotation: readonly RotationCommand[];
  readonly baseConfig: Gw2Config;
  readonly equippedRelic: string;
  readonly comparisonRelic: string;
}

/** Supplies the displayed baseline and selected assumptions for the local counterfactual calculations. */
export interface RelicComparisonCalculationRequest extends RelicComparisonRequest {
  readonly baselineResult: Pick<
    Gw2SimulationResult,
    'dps' | 'breakdown' | 'resolvedEvents' | 'dpsStartTime' | 'firstHitTime' | 'combatEndTime'
  >;
  readonly initialStacks: number;
}
