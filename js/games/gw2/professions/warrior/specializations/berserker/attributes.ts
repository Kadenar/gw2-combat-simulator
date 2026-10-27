import type { Gw2AttributeContributionCalculator } from '#gw2/platform/attributes/types.js';
import { attributeBonusNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { active } from '#gw2/professions/warrior/specializations/berserker/traits/behavior.js';

/** Berserk grants final Power and Condition Damage without feeding ordinary trait conversions. */
export const berserkerAttributes: Gw2AttributeContributionCalculator = (context) => {
  if (!active(context)) return [];

  const profile = requireBalanceProfileFromContext(context, TRAIT.FATAL_FRENZY);
  const power = attributeBonusNumber(profile, 'power');
  return [
    {
      attributeEffects: [
        { kind: 'flat', to: 'Power', amount: power, feedsConversions: 'none' },
        {
          kind: 'flat',
          to: 'Condition Damage',
          amount: attributeBonusNumber(profile, 'conditionDamage'),
          feedsConversions: 'none'
        }
      ]
    }
  ];
};
