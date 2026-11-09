/** Owns the modifiers contracts used by its runner, runtime adapter, and views. */
import type { GameContentAddress } from '#browser/game/contracts.js';
import type { ProfessionModifier } from '#gw2/build-context/types.js';
import type { RotationCommand } from '#gw2/platform/builds/rotation.js';
import type { BoonId } from '#gw2/platform/constants.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

export interface ProfessionModifierComparison {
  readonly modifier: ProfessionModifier;
  readonly config: Gw2Config;
}

/** Workers receive only the omission inputs; the caller owns the already computed baseline. */
export interface ModifierContributionBatchRequest extends GameContentAddress {
  readonly rotation: readonly RotationCommand[];
  readonly comparisons: readonly ProfessionModifierComparison[];
}

/** An explicit deterministic baseline keeps interactive and standalone comparisons on the same contract. */
export interface ModifierContributionRequest extends ModifierContributionBatchRequest {
  readonly baselineDps: number;
}

/** Each score omits its named modifier so contribution calculations can compare it with the full-build baseline. */
export interface ModifierContributionBatchResult {
  readonly scores: readonly {
    readonly id: string;
    readonly name: string;
    readonly boonId?: BoonId;
    readonly dpsWithoutModifier: number;
  }[];
}

/** Boon identity survives worker scoring independently of the displayed modifier label. */
export interface ModifierContribution {
  readonly boonId?: BoonId;
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
