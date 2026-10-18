import type { RelicComparisonModel } from '#gw2/app/optimizer/relic-comparison/relic-comparison.js';
/** Owns the relic-comparison contracts used by its runner, runtime adapter, and views. */
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { RotationCommand } from '#gw2/platform/builds/rotation.js';
import type { Gw2SimulationResult } from '#gw2/platform/results/types.js';

export interface RelicComparisonRequest {
  readonly rotation: readonly RotationCommand[];
  readonly baseConfig: Gw2Config;
  readonly opponentRelic: string;
  readonly comparisonRelic: string;
}

/** Supplies the displayed baseline and selected assumptions for the local counterfactual calculations. */
export interface RelicComparisonCalculationRequest extends RelicComparisonRequest {
  readonly opponentResult: Pick<
    Gw2SimulationResult,
    'dps' | 'breakdown' | 'resolvedEvents' | 'dpsStartTime' | 'firstHitTime' | 'combatEndTime'
  >;
  readonly initialStacks: number;
}

/** Holds this feature's session result and error state alongside its owning contracts. */
export interface RelicComparisonResultState {
  relicComparisonAvailable?: boolean;
  relicComparisonError?: string;
  relicComparisonOpponent?: string;
  relicComparisonTarget?: string;
  relicComparisonInitialStacks?: number;
  relicComparison?: RelicComparisonModel;
}
