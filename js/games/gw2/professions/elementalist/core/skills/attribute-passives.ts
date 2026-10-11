import { passiveAttribute } from '#gw2/platform/builds/attribute-passives.js';
import type { Gw2AttributeContributionCalculator } from '#gw2/platform/builds/types.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
/** Selected skill passives use the same readiness and tuning for build previews and live attribute queries. */
export const elementalistPassiveAttributes: Gw2AttributeContributionCalculator = (context) => [
  {
    attributeEffects: [
      passiveAttribute(
        context,
        ID.SIGNET_OF_FIRE,
        'elementalist.core.signet-of-fire-passive',
        'Precision',
        'attributeBonus',
        () =>
          hasTrait(context, TRAIT.WRITTEN_IN_STONE) ||
          !context.timeline?.skillOnCooldownAt(ID.SIGNET_OF_FIRE, context.time)
      )
    ]
  }
];
