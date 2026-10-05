import {
  FEROCITY_PER_CRITICAL_DAMAGE_MULTIPLIER,
  PRECISION_PER_CRITICAL_CHANCE_FRACTION
} from '#gw2/platform/combat/formulas.js';
import type { Gw2CriticalChanceContributor, Gw2QueryRuntime } from '#gw2/platform/combat/query/combat-query.js';
import { SIGIL_IDS, SIGIL_BY_ID } from '#gw2/platform/equipment/sigils/data.js';
import { buffApplicationStacks } from '#gw2/platform/combat/boons.js';
import type { BuffStatePolicy } from '#gw2/platform/combat/effect-state.js';

/** Keep the observation schema available after a swap while an accepted Severance grant survives. */
export const SEVERANCE_BUFF_POLICY: BuffStatePolicy = Object.freeze({ kind: 'sigil-severance', maximumStacks: 1 });

interface SeveranceCriticalContribution {
  readonly chance: number;
  readonly damage: number;
  readonly chanceContributors: readonly Gw2CriticalChanceContributor[];
}

const NO_CRITICAL_CONTRIBUTION: Readonly<SeveranceCriticalContribution> = Object.freeze({
  chance: 0,
  damage: 0,
  chanceContributors: Object.freeze([])
});

/** Converts Severance's active precision and ferocity buff into additive critical modifiers. */
export function severanceCriticalContribution(
  runtime: Gw2QueryRuntime | null | undefined,
  at: number
): Readonly<SeveranceCriticalContribution> {
  // Query recorded windows so refreshes and historical observations share the canonical buff state.
  if (!buffApplicationStacks(runtime?.buffs?.get('sigil-severance') || [], 'sigil-severance', at, 1)) {
    return NO_CRITICAL_CONTRIBUTION;
  }

  const severance = SIGIL_BY_ID[SIGIL_IDS.SEVERANCE];
  const chance = (severance.procPrecision || 0) / PRECISION_PER_CRITICAL_CHANCE_FRACTION;
  return {
    chance,
    damage: (severance.procFerocity || 0) / FEROCITY_PER_CRITICAL_DAMAGE_MULTIPLIER,
    chanceContributors: [
      {
        id: 'sigil-severance',
        label: 'Sigil of Severance',
        amount: chance
      }
    ]
  };
}
