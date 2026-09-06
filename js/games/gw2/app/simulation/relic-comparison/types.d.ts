/** Owns the relic-comparison contracts used by its runner, runtime adapter, and views. */
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { GameContentAddress } from '#app/shell/types.js';
import type { RotationCommand } from '#gw2/platform/engine/execution/types.js';

export interface RelicComparisonJobRequest extends GameContentAddress {
  readonly rotation: readonly RotationCommand[];
  readonly baseConfig: Gw2Config;
  readonly opponentRelic: string;
  readonly comparisonRelic: string;
}
