import type { Gw2AttributeContributionCalculator } from '#gw2/platform/builds/types.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { BERSERKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/berserker/profiles.js';
import { active } from '#gw2/professions/warrior/specializations/berserker/traits/behavior.js';

/** Berserk grants final Power and Condition Damage without feeding ordinary trait conversions. */
export const berserkerAttributes: Gw2AttributeContributionCalculator = (context) => {
  if (!active(context)) return [];
  const profile = requireBalanceProfileFromContext(context, PROFILE.resources);
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
