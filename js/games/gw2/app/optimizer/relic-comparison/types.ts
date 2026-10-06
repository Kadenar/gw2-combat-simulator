import type { RelicComparisonModel } from '#gw2/app/optimizer/relic-comparison/relic-comparison.js';
/** Owns the relic-comparison contracts used by its runner, runtime adapter, and views. */
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { GameContentAddress } from '#browser/game/contracts.js';
import type { RotationCommand } from '#gw2/platform/execution/rotation.js';

export interface RelicComparisonJobRequest extends GameContentAddress {
  readonly rotation: readonly RotationCommand[];
  readonly baseConfig: Gw2Config;
  readonly opponentRelic: string;
  readonly comparisonRelic: string;
}

/** Holds this feature's session result and pending/error state alongside its owning contracts. */
export interface RelicComparisonResultState {
  relicComparisonAvailable?: boolean;
  relicComparisonStale?: boolean;
  relicComparisonError?: string;
  relicComparisonOpponent?: string;
  relicComparisonTarget?: string;
  relicComparisonInitialStacks?: number;
  relicComparison?: RelicComparisonModel;
}
