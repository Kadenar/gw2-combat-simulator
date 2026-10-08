import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { powerScaledConditionAttributes } from '#gw2/platform/combat/modifiers.js';
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import type { Gw2MutableStats, Gw2Stats } from '#gw2/platform/combat/stats.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import {
  activeBoonStacks,
  engineerEvent,
  targetHealthFraction
} from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';

/** Apply Firearms stat and duration policies at modifier boundaries without duplicating build-time bonuses. */

/** Applies Chemical Rounds at the live attribute boundary while preserving build provenance. */
export function applyChemicalRoundsAttributes(context: Gw2ModifierContext, modified: Gw2MutableStats): void {
  if (hasTrait(context, TRAIT.CHEMICAL_ROUNDS) && !professionStaticRulesApplied(context.config)) {
    const chemicalRoundsProfile = requireBalanceProfileFromContext(context, TRAIT.CHEMICAL_ROUNDS);
    modified.conditionDamage =
      (modified.conditionDamage || 0) + balanceProfileNumber(chemicalRoundsProfile, 'attributeBonus');
  }
}

/** Applies Thermal Vision at the live attribute boundary while preserving build provenance. */
export function applyThermalVisionAttributes(context: Gw2ModifierContext, modified: Gw2MutableStats): void {
  if (hasTrait(context, TRAIT.THERMAL_VISION) && !professionStaticRulesApplied(context.config)) {
    const thermalVisionProfile = requireBalanceProfileFromContext(context, TRAIT.THERMAL_VISION);
    modified.expertise = (modified.expertise || 0) + balanceProfileNumber(thermalVisionProfile, 'attributeBonus');
  }
}

/** Applies No Scope at the live attribute boundary while preserving build provenance. */
export function applyNoScopeAttributes(context: Gw2ModifierContext, modified: Gw2MutableStats): void {
  if (
    hasTrait(context, TRAIT.NO_SCOPE) &&
    activeBoonStacks(context, 'fury', 1) > 0 &&
    !(professionStaticRulesApplied(context.config) && Boolean(context.config?.boons?.fury))
  ) {
    const noScopeProfile = requireBalanceProfileFromContext(context, TRAIT.NO_SCOPE);
    modified.ferocity = (modified.ferocity || 0) + balanceProfileNumber(noScopeProfile, 'attributeBonus');
  }
}

// Chemical Rounds extends pistol-skill base durations before the normal capped condition-duration multiplier.
export function applyChemicalRoundsConditionDuration(context: Gw2ModifierContext, multiplier: number): number {
  if (!hasTrait(context, TRAIT.CHEMICAL_ROUNDS)) return multiplier;
  const event = engineerEvent(context);
  const application = event?.application || event;
  // trait-sourced conditions (e.g. Incendiary Powder) don't get Chemical Rounds amplification
  if (application?.source === 'Trait') return multiplier;
  const skill = skillForEvent(context.profession?.catalog, context.event, context.skillId);
  // condition events from different layers carry the weapon type at different paths — check all three
  if (event?.skillWeapon !== 'Pistol' && event?.application?.skillWeapon !== 'Pistol' && skill?.weapon !== 'Pistol') {
    return multiplier;
  }

  const chemicalRoundsProfile = requireBalanceProfileFromContext(context, TRAIT.CHEMICAL_ROUNDS);
  // Apply the skill-specific increase uniformly so every pistol condition keeps it beyond the global duration cap.
  return multiplier * balanceProfileNumber(chemicalRoundsProfile, 'conditionDurationMultiplier');
}

/** Selects Heavy Metal's critical bonus from the target's current health tier. */
export function heavyMetalBonus(context: Gw2ModifierContext): number {
  const fraction = targetHealthFraction(context);
  const heavyMetalProfile = requireBalanceProfileFromContext(context, TRAIT.HEAVY_METAL);
  if (fraction < balanceProfileNumber(heavyMetalProfile, 'lowerThreshold'))
    return balanceProfileNumber(heavyMetalProfile, 'lowerBonus');
  if (fraction < balanceProfileNumber(heavyMetalProfile, 'middleThreshold'))
    return balanceProfileNumber(heavyMetalProfile, 'middleBonus');
  if (fraction < balanceProfileNumber(heavyMetalProfile, 'upperThreshold'))
    return balanceProfileNumber(heavyMetalProfile, 'upperBonus');
  return 0;
}

/** Sharpshooter scales Bleeding from final Power after all attribute owners have contributed. */
export function applySharpshooterConditionAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  return powerScaledConditionAttributes(context, attributes, 'Bleeding', TRAIT.SHARPSHOOTER);
}

/** No Scope's live boon bonus is excluded before the mech inherits the player's base attributes. */
export function noScopeBoonFerocity(context: Gw2ModifierContext): number {
  return hasTrait(context, TRAIT.NO_SCOPE) && activeBoonStacks(context, 'fury', 1) > 0
    ? balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.NO_SCOPE), 'attributeBonus')
    : 0;
}
