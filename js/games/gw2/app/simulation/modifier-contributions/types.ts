/** Owns the modifiers contracts used by its runner, runtime adapter, and views. */
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { GameContentAddress } from '#browser/game/contracts.js';
import type { RotationCommand } from '#gw2/platform/builds/rotation.js';
import type { ProfessionModifier } from '#gw2/build-context/types.js';

export interface ProfessionModifierComparison {
  readonly modifier: ProfessionModifier;
  readonly config: Gw2Config;
}

export interface ModifierContributionRequest extends GameContentAddress {
  readonly rotation: readonly RotationCommand[];
  readonly baseConfig: Gw2Config;
  readonly comparisons: readonly ProfessionModifierComparison[];
}

/** Only one batch receives the deterministic baseline configuration; other workers simulate omissions only. */
export interface ModifierContributionBatchRequest extends Omit<ModifierContributionRequest, 'baseConfig'> {
  readonly baseConfig: Gw2Config | null;
}

export interface ModifierContributionBatchResult {
  readonly baselineDps: number | null;
  readonly scores: readonly { readonly id: string; readonly name: string; readonly dps: number }[];
}

export interface ModifierContribution {
  readonly id: string;
  readonly name: string;
  readonly dpsIncrease: number;
  readonly pctIncrease: number;
}

/** Holds this feature's session result and pending/error state alongside its owning contracts. */
export interface ModifierContributionResultState {
  contributions?: ModifierContribution[];
  modifierContributionsStale?: boolean;
  modifierContributionsError?: string;
}
