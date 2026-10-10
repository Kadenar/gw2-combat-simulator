import type { Gw2AttributeContributionCalculator } from '#gw2/platform/builds/types.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { berserkFortitudeEffects } from '#gw2/professions/warrior/core/traits/strength/index.js';
import { BERSERKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/berserker/profiles.js';
import { active } from '#gw2/professions/warrior/specializations/berserker/traits/behavior.js';

/** Berserk owns its live flats and explicitly admits only its own Power to Great Fortitude. */
export const berserkerAttributes: Gw2AttributeContributionCalculator = (context) => {
  if (!active(context)) return [];
  const profile = requireBalanceProfileFromContext(context, PROFILE.resources);
  const power = balanceProfileNumber(profile, 'attributeBonus');
  return [
    {
      attributeEffects: [
        { kind: 'flat', to: 'Power', amount: power, feedsConversions: false },
        {
          kind: 'flat',
          to: 'Condition Damage',
          amount: balanceProfileNumber(profile, 'attributePerStack'),
          feedsConversions: false
        },
        ...berserkFortitudeEffects(context, power)
      ]
    }
  ];
};
