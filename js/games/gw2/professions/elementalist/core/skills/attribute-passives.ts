import { passiveSkillAttributes } from '#gw2/platform/attributes/passives.js';
import type { Gw2AttributeContributionCalculator } from '#gw2/platform/attributes/types.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';

/** Selected skill passives use the same readiness and tuning for build previews and live attribute queries. */
export const elementalistPassiveAttributes: Gw2AttributeContributionCalculator = (context) => [
  {
    // Written in Stone keeps Signet of Fire's skill-owned precision while the signet recharges.
    attributeEffects: passiveSkillAttributes(
      context,
      ID.SIGNET_OF_FIRE,
      () =>
        hasTrait(context, TRAIT.WRITTEN_IN_STONE) ||
        !context.timeline?.skillOnCooldownAt(ID.SIGNET_OF_FIRE, context.time)
    )
  }
];
