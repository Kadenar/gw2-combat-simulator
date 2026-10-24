import { passiveAttribute } from '#gw2/platform/attributes/passives.js';
import type { Gw2AttributeContributionCalculator } from '#gw2/platform/attributes/types.js';
import { buffActive, hasSelectedSkillId } from '#gw2/platform/combat/query/runtime-query.js';
import { balanceNumberFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

/** Selected skill passives use the same readiness and tuning for build previews and live attribute queries. */
export const thiefPassiveAttributes: Gw2AttributeContributionCalculator = (context) => [
  {
    // The active signet is a separate ineligible grant, with its existing selection and effect-window gates.
    attributeEffects: [
      {
        kind: 'flat',
        to: 'Power',
        feedsConversions: 'none',
        amount:
          hasSelectedSkillId(context, ID.ASSASSINS_SIGNET) && buffActive(context, 'assassins-signet')
            ? balanceNumberFromContext(context, PROFILE.assassinsSignet, 'attributePerStack')
            : 0
      },
      passiveAttribute(context, ID.SIGNET_OF_AGILITY, PROFILE.signetOfAgility, 'Precision', 'attributeBonus'),
      // Live readiness restores the passive after recharge reductions or resets, independently of the active buff.
      passiveAttribute(context, ID.ASSASSINS_SIGNET, PROFILE.assassinsSignet, 'Power', 'attributeBonus')
    ]
  }
];
