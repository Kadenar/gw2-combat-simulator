import { ownerAttributeEffects, passiveSkillAttributes } from '#gw2/platform/attributes/passives.js';
import type { Gw2AttributeContributionCalculator } from '#gw2/platform/attributes/types.js';
import { buffActive, hasSelectedSkillId } from '#gw2/platform/combat/query/runtime-query.js';
import { requireSkillFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';

/** Selected skill passives use the same readiness and tuning for build previews and live attribute queries. */
export const thiefPassiveAttributes: Gw2AttributeContributionCalculator = (context) => [
  {
    // Active grants use the shared attribute map, gated independently from cooldown-based passive eligibility.
    attributeEffects: [
      ...(hasSelectedSkillId(context, ID.ASSASSINS_SIGNET) && buffActive(context, 'assassins-signet')
        ? ownerAttributeEffects({
            attributeBonuses: requireSkillFromContext(context.balanceContext, ID.ASSASSINS_SIGNET)
              .activeAttributeBonuses
          })
        : []),
      ...passiveSkillAttributes(context, ID.SIGNET_OF_AGILITY),
      // Live readiness restores the passive after recharge reductions or resets, independently of the active buff.
      ...passiveSkillAttributes(context, ID.ASSASSINS_SIGNET)
    ]
  }
];
