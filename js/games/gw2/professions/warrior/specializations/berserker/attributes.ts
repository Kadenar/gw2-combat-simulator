import type { Gw2AttributeContributionCalculator } from '#gw2/platform/attributes/types.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { active } from '#gw2/professions/warrior/specializations/berserker/traits/behavior.js';

/** Berserk grants final Power and Condition Damage without feeding ordinary trait conversions. */
export const berserkerAttributes: Gw2AttributeContributionCalculator = (context) => {
  if (!active(context)) return [];

  const profile = requireBalanceProfileFromContext(context, TRAIT.FATAL_FRENZY);
  const power = balanceProfileNumber(profile, 'attributeBonus');
  return [
    {
      attributeEffects: [
        { kind: 'flat', to: 'Power', amount: power, feedsConversions: 'none' },
        {
          kind: 'flat',
          to: 'Condition Damage',
          amount: balanceProfileNumber(profile, 'attributePerStack'),
          feedsConversions: 'none'
        }
      ]
    }
  ];
};
