import { passiveAttribute } from '#gw2/platform/builds/attribute-passives.js';
import type { Gw2AttributeContributionCalculator } from '#gw2/platform/builds/types.js';
import {
  guardianSignetPassiveActive,
  perfectInscriptionsMultiplier
} from '#gw2/professions/guardian/core/traits/radiance/behavior.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
/** Selected skill passives use the same readiness and tuning for build previews and live attribute queries. */
export const guardianPassiveAttributes: Gw2AttributeContributionCalculator = (context) => [
  {
    attributeEffects: [
      passiveAttribute(
        context,
        ID.BANE_SIGNET,
        'guardian.core.bane-signet-passive',
        'Power',
        'attributeBonus',
        () => guardianSignetPassiveActive(context, ID.BANE_SIGNET),
        perfectInscriptionsMultiplier(context)
      ),
      passiveAttribute(
        context,
        ID.SIGNET_OF_WRATH,
        'guardian.core.signet-of-wrath-passive',
        'Condition Damage',
        'attributeBonus',
        () => guardianSignetPassiveActive(context, ID.SIGNET_OF_WRATH),
        perfectInscriptionsMultiplier(context)
      )
    ]
  }
];
