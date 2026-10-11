import { passiveAttribute } from '#gw2/platform/builds/attribute-passives.js';
import type { Gw2AttributeContributionCalculator } from '#gw2/platform/builds/types.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
/** Selected skill passives use the same readiness and tuning for build previews and live attribute queries. */
export const mesmerPassiveAttributes: Gw2AttributeContributionCalculator = (context) => [
  {
    attributeEffects: [
      passiveAttribute(
        context,
        ID.SIGNET_OF_DOMINATION,
        'mesmer.core.signet-of-domination-passive',
        'Condition Damage',
        'conditionDamageBonus'
      ),
      passiveAttribute(
        context,
        ID.SIGNET_OF_MIDNIGHT,
        'mesmer.core.signet-of-midnight-passive',
        'Expertise',
        'expertiseBonus'
      )
    ]
  }
];
