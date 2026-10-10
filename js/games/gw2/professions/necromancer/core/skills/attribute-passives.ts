import { passiveAttribute } from '#gw2/platform/builds/attribute-passives.js';
import type { Gw2AttributeContributionCalculator } from '#gw2/platform/builds/types.js';
import {
  playerModifierContext,
  signetOfSpitePassiveActive
} from '#gw2/professions/necromancer/core/skills/slot-skills.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
/** Selected skill passives use the same readiness and tuning for build previews and live attribute queries. */
export const necromancerPassiveAttributes: Gw2AttributeContributionCalculator = (context) => [
  {
    attributeEffects: [
      passiveAttribute(
        context,
        ID.SIGNET_OF_SPITE,
        'necromancer.core.signet-of-spite-passive',
        'Power',
        'attributeBonus',
        playerModifierContext(context) && signetOfSpitePassiveActive(context)
      )
    ]
  }
];
