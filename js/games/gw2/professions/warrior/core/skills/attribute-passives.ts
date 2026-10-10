import type { Gw2AttributeContributionCalculator } from '#gw2/platform/builds/types.js';
import { signetAttributeEffects } from '#gw2/professions/warrior/core/skills/slot-skills.js';
/** Selected skill passives use the same readiness and tuning for build previews and live attribute queries. */
export const warriorPassiveAttributes: Gw2AttributeContributionCalculator = (context) => [
  { attributeEffects: signetAttributeEffects(context) }
];
