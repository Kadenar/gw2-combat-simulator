import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2MutableStats, Gw2Stats } from '#gw2/platform/combat/stats.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { elementalistMightStacks } from '#gw2/professions/elementalist/core/mechanics/modifier-queries.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistModifierContext } from '#gw2/professions/elementalist/types.js';

/**
 * Applies Enhanced Potency's attribute bonuses: ferocity while Fury is up on an
 * Air Evoker, and might-scaled condition damage on a Fire Evoker.
 */
// ferocity and conditionDamage added here rather than as modifier rules because they must feed into crit-damage and condition scaling before those are computed
export function applyEnhancedPotencyAttributes(context: ElementalistModifierContext, attributes: Gw2Stats): Gw2Stats {
  const modified: Gw2MutableStats = { ...attributes };
  if (
    context.config?.evokerElement === 'Air' &&
    Boolean(context.query?.furyActiveAt(context.time, context.runtime, context.event))
  ) {
    const enhancedPotencyProfile = requireBalanceProfileFromContext(context, TRAIT.ENHANCED_POTENCY);
    modified.ferocity = (modified.ferocity || 0) + balanceProfileNumber(enhancedPotencyProfile, 'attributeBonus');
  }

  if (context.config?.evokerElement === 'Fire' && hasTrait(context, TRAIT.ENHANCED_POTENCY)) {
    const enhancedPotencyProfile = requireBalanceProfileFromContext(context, TRAIT.ENHANCED_POTENCY);
    // Fire Enhanced Potency scales condition damage per might stack
    modified.conditionDamage =
      (modified.conditionDamage || 0) +
      elementalistMightStacks(context) * balanceProfileNumber(enhancedPotencyProfile, 'attributePerStack');
  }

  return modified;
}
