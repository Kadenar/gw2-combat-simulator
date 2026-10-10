import { passiveAttribute } from '#gw2/platform/builds/attribute-passives.js';
import type { Gw2AttributeContributionCalculator } from '#gw2/platform/builds/types.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profile-ids.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
/** Selected skill passives use the same readiness and tuning for build previews and live attribute queries. */
export const rangerPassiveAttributes: Gw2AttributeContributionCalculator = (context) => [
  {
    // Storm Spirit replaces only Power after player and specialization contributions.
    transforms:
      context.event?.type === 'damage' && context.event.skillId === ID.CALL_LIGHTNING
        ? [{ kind: 'project', replace: false, attributes: { power: 1580 } }]
        : [],
    attributeEffects: [
      passiveAttribute(context, ID.SIGNET_OF_THE_WILD, PROFILE.signetOfTheWild, 'Ferocity', 'attributeBonus')
    ]
  }
];
