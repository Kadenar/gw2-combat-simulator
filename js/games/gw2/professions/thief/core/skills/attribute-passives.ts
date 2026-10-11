import { passiveAttribute } from '#gw2/platform/builds/attribute-passives.js';
import type { Gw2AttributeContributionCalculator } from '#gw2/platform/builds/types.js';
import { buffActive, hasSelectedSkillId } from '#gw2/platform/combat/query/runtime-query.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import { thiefRuntimeState } from '#gw2/professions/thief/core/state-queries.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
/** Selected skill passives use the same readiness and tuning for build previews and live attribute queries. */
export const thiefPassiveAttributes: Gw2AttributeContributionCalculator = (context) => [
  {
    // The active signet is a separate ineligible grant, with its existing selection and effect-window gates.
    attributeEffects: [
      {
        kind: 'flat',
        to: 'Power',
        feedsConversions: false,
        amount:
          hasSelectedSkillId(context, ID.ASSASSINS_SIGNET) && buffActive(context, 'assassins-signet')
            ? balanceProfileNumber(
                requireBalanceProfileFromContext(context, PROFILE.assassinsSignet),
                'attributePerStack'
              )
            : 0
      },
      passiveAttribute(context, ID.SIGNET_OF_AGILITY, PROFILE.signetOfAgility, 'Precision', 'attributeBonus'),
      passiveAttribute(
        context,
        ID.ASSASSINS_SIGNET,
        PROFILE.assassinsSignet,
        'Power',
        'attributeBonus',
        (thiefRuntimeState(context).assassinsSignetPassiveDisabledUntil ?? 0) <= context.time
      )
    ]
  }
];
