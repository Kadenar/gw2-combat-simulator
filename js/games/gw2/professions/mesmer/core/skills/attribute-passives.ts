import { passiveSkillAttributes } from '#gw2/platform/attributes/passives.js';
import type { Gw2AttributeContributionCalculator } from '#gw2/platform/attributes/types.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

/** Preview and combat use each selected signet's attributes with the same cooldown suppression. */
export const mesmerPassiveAttributes: Gw2AttributeContributionCalculator = (context) => [
  {
    attributeEffects: [
      ...passiveSkillAttributes(context, ID.SIGNET_OF_DOMINATION),
      ...passiveSkillAttributes(context, ID.SIGNET_OF_MIDNIGHT)
    ]
  }
];
