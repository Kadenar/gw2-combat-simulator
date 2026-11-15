/** Owns the relic-comparison contracts used by its runner, runtime adapter, and views. */
import type { RotationCommand } from '#gw2/platform/builds/rotation.js';
import type { Gw2SimulationResult } from '#gw2/platform/results/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

/** Bound synchronous comparison work while allowing the equipped relic plus five alternatives. */
export const MAX_RELIC_COMPARISON_ALTERNATIVES = 5;

export interface RelicComparisonRequest {
  readonly rotation: readonly RotationCommand[];
  readonly baseConfig: Gw2Config;
  readonly equippedRelic: string;
  readonly comparisonRelics: readonly string[];
}

/** Supplies the displayed baseline and selected assumptions for the local counterfactual calculations. */
export interface RelicComparisonCalculationRequest extends RelicComparisonRequest {
  readonly baselineResult: Pick<Gw2SimulationResult, 'deathTime' | 'dpsStartTime' | 'combatEndTime'>;
  readonly initialStacks: number;
}
