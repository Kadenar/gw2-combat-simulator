import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import type { Gw2NumericStatKey, Gw2ResolvedStats } from '#gw2/platform/combat/stats.js';
import { readProfessionCoreState } from '#gw2/platform/profession-definition/state.js';
import { rangerPetByName } from '#gw2/professions/ranger/core/state.js';
import {
  goForTheThroatMergedModifier,
  loudWhistleMergedModifier
} from '#gw2/professions/ranger/core/traits/beastmastery/index.js';
import {
  applyPackAlphaMerged,
  applyPetsProwessMerged
} from '#gw2/professions/ranger/core/traits/beastmastery/pet-attributes.js';
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

/** Reconciles Soulbeast merge attributes against the calculator's static merged baseline. */
function modifySoulbeastAttributes(context: RangerModifierContext, attributes: Gw2ResolvedStats): Gw2ResolvedStats {
  const result = { ...attributes };
  const staticRulesApplied = professionStaticRulesApplied(context.config);
  const merged = beastmodeActive(context);
  const adjust = (attribute: Gw2NumericStatKey, amount: number): void => {
    result[attribute] = (result[attribute] || 0) + amount;
  };

  if (!staticRulesApplied && merged) {
    applyPackAlphaMerged(context, adjust, 1);
    applyPetsProwessMerged(context, adjust, 1);

    for (const [attribute, amount] of Object.entries(
      soulbeastArchetypeAttributes(context, petArchetype(context, true))
    )) {
      adjust(attribute as Gw2NumericStatKey, amount);
    }
  } else if (staticRulesApplied && !merged) {
    applyPackAlphaMerged(context, adjust, -1);
    applyPetsProwessMerged(context, adjust, -1);

    for (const [attribute, amount] of Object.entries(
      soulbeastArchetypeAttributes(context, petArchetype(context, false))
    )) {
      adjust(attribute as Gw2NumericStatKey, -amount);
    }
  } else if (staticRulesApplied && merged) {
    const configuredArchetype = petArchetype(context, false);
    const activeArchetype = petArchetype(context, true);

    for (const [attribute, amount] of Object.entries(soulbeastArchetypeAttributes(context, configuredArchetype))) {
      adjust(attribute as Gw2NumericStatKey, -amount);
    }

    for (const [attribute, amount] of Object.entries(soulbeastArchetypeAttributes(context, activeArchetype))) {
      adjust(attribute as Gw2NumericStatKey, amount);
    }
  }

  return result;
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
  modifyAttributes: modifySoulbeastAttributes,
  // Preserve the Core merged-pet contributions before skill-owned rules.
  modifierRules: [loudWhistleMergedModifier, goForTheThroatMergedModifier, ...soulbeastModifierRules]
});
