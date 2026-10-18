import { ATTRIBUTE_NAMES } from '#gw2/platform/attributes/inputs.js';
import type { Gw2AttributeContributionCalculator } from '#gw2/platform/attributes/types.js';
import { activeRangerPet, beastmodeActive } from '#gw2/professions/ranger/core/traits/modifier-queries.js';
import { soulbeastArchetypeAttributes } from '#gw2/professions/ranger/specializations/soulbeast/mechanics/archetype-attributes.js';

// Resolve the merged pet archetype's live attribute contribution, including
// trait adjustments, without mutating the shared base stats.

/** The active pet supplies merge attributes to both preview and combat without conversion eligibility. */
export const soulbeastAttributes: Gw2AttributeContributionCalculator = (context) => {
  if (!(context.runtime ? beastmodeActive(context) : context.loadout.merged)) return [];

  return [
    {
      attributeEffects: Object.entries(soulbeastArchetypeAttributes(context, activeRangerPet(context).archetype)).map(
        ([key, amount]) => ({
          kind: 'flat',
          to: ATTRIBUTE_NAMES[key as keyof typeof ATTRIBUTE_NAMES],
          amount,
          feedsConversions: 'none'
        })
      )
    }
  ];
};
