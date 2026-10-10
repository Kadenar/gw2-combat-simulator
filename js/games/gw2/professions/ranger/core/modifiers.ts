import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/stats.js';
import { rangerAttackOfOpportunityModifier } from '#gw2/professions/ranger/core/mechanics/greatsword.js';
import { rangerConsumingBiteModifier } from '#gw2/professions/ranger/core/skills/pets/fanged-iboga.js';
import { modifyStormSpiritAttributes } from '#gw2/professions/ranger/core/skills/slot-skills.js';
import {
  rangerHammerConditionsModifier,
  rangerHammerDisabledModifier
} from '#gw2/professions/ranger/core/skills/weapons/hammer.js';
import { rangerFalconsStoopModifier } from '#gw2/professions/ranger/core/skills/weapons/spear.js';
import { rangerPounceModifier } from '#gw2/professions/ranger/core/skills/weapons/sword.js';
import {
  modifyRangerPetAttributes,
  rangerPetModifierRules
} from '#gw2/professions/ranger/core/traits/pet-modifiers.js';
import { modifyRangerConditionBaseDuration } from '#gw2/professions/ranger/core/traits/skirmishing/attributes.js';

/** Independent pet attributes retain their actor-owned conversion policy. */
function modifyRangerAttributes(context: Gw2ModifierContext, attributes: Gw2ResolvedStats): Gw2ResolvedStats {
  const result = { ...attributes };
  modifyRangerPetAttributes(context, result);
  return result;
}

const rangerPlayerAndSharedModifierRules: readonly Gw2ModifierRule[] = [
  rangerHammerDisabledModifier,
  rangerPounceModifier,
  rangerFalconsStoopModifier,
  rangerHammerConditionsModifier,
  rangerConsumingBiteModifier
];

// Keep player/shared and pet-audience collections distinct while preserving one public rule list.
const rangerCoreModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  rangerAttackOfOpportunityModifier,
  ...rangerPlayerAndSharedModifierRules.map((rule, index) => ({ ...rule, order: 15 + index })),
  ...rangerPetModifierRules.map((rule, index) => ({ ...rule, order: 30 + index }))
]);

export const rangerCoreModifiers = Object.freeze({
  modifyAttributes: [
    modifyRangerAttributes,
    // Resolve spirit Power after the ordinary Core, specialization, and trait attribute hooks (order 0).
    { id: 'ranger.storm-spirit-attributes', order: 1, handler: modifyStormSpiritAttributes }
  ],
  modifyConditionBaseDuration: modifyRangerConditionBaseDuration,
  modifierRules: rangerCoreModifierRules
});
