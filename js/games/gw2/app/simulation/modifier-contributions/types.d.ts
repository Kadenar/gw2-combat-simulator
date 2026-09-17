/** Owns the modifiers contracts used by its runner, runtime adapter, and views. */
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { GameContentAddress } from '#app/shell/types.js';
import type { RotationCommand } from '#gw2/platform/engine/execution/types.js';

export type ProfessionModifierType = 'Boon' | 'Target' | 'Sigil' | 'Relic' | 'Food' | 'Utility' | 'Trait';

export interface ProfessionModifier {
  readonly id: string;
  readonly type: ProfessionModifierType;
  readonly name: string;
  readonly label: string;
}

export interface ProfessionModifierComparison {
  readonly modifier: ProfessionModifier;
  readonly config: Gw2Config;
}

export interface ModifierContributionRequest extends GameContentAddress {
  readonly rotation: readonly RotationCommand[];
  readonly baseConfig: Gw2Config;
  readonly comparisons: readonly ProfessionModifierComparison[];
}

export interface ModifierContribution {
  readonly id: string;
  readonly name: string;
  readonly dpsIncrease: number;
  readonly pctIncrease: number;
}
