import { ATTRIBUTE_NAMES } from '#gw2/platform/builds/attribute-inputs.js';
import type { Gw2AttributeContributionCalculator } from '#gw2/platform/builds/types.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { readProfessionCoreState } from '#gw2/platform/profession-definition/state.js';
import { rangerPetByName } from '#gw2/professions/ranger/core/state.js';
import {
  goForTheThroatMergedModifier,
  loudWhistleMergedModifier
} from '#gw2/professions/ranger/core/traits/beastmastery/index.js';
import { activeBuff, beastmodeActive } from '#gw2/professions/ranger/core/traits/modifier-queries.js';
import { soulbeastArchetypeAttributes } from '#gw2/professions/ranger/specializations/soulbeast/mechanics/archetype-attributes.js';
import type { RangerModifierContext } from '#gw2/professions/ranger/types.js';

// Resolve the merged pet archetype's live attribute contribution, including
// trait adjustments, without mutating the shared base stats.

function petArchetype(context: RangerModifierContext, active: boolean): string {
  const configured = active
    ? readProfessionCoreState<{ activePet?: string }>(context.runtime?.profession).activePet ||
      context.config?.selectedPet
    : context.config?.selectedPet;
  return rangerPetByName(configured || 'Pig').archetype;
}

// Skill-owned player modifiers remain alongside the merged attribute calculation.
const soulbeastModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'ranger.sic-em-player',
    order: 102,
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.25,
    when: (context) => activeBuff(context, 'sic-em')
  }
]);

export const soulbeastModifiers = Object.freeze({
  // Preserve the Core merged-pet contributions before skill-owned rules.
  modifierRules: [loudWhistleMergedModifier, goForTheThroatMergedModifier, ...soulbeastModifierRules]
});

/** The active pet supplies merge attributes to both preview and combat without conversion eligibility. */
export const soulbeastAttributes: Gw2AttributeContributionCalculator = (context) => {
  if (!(context.runtime ? beastmodeActive(context) : context.loadout.merged)) return [];
  return [
    {
      attributeEffects: Object.entries(soulbeastArchetypeAttributes(context, petArchetype(context, true))).map(
        ([key, amount]) => ({
          kind: 'flat',
          to: ATTRIBUTE_NAMES[key as keyof typeof ATTRIBUTE_NAMES],
          amount,
          feedsConversions: false
        })
      )
    }
  ];
};
