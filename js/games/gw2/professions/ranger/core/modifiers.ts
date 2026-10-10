import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { rangerAttackOfOpportunityModifier } from '#gw2/professions/ranger/core/mechanics/greatsword.js';
import { rangerConsumingBiteModifier } from '#gw2/professions/ranger/core/skills/pets/fanged-iboga.js';
import {
  rangerHammerConditionsModifier,
  rangerHammerDisabledModifier
} from '#gw2/professions/ranger/core/skills/weapons/hammer.js';
import { rangerFalconsStoopModifier } from '#gw2/professions/ranger/core/skills/weapons/spear.js';
import { rangerPounceModifier } from '#gw2/professions/ranger/core/skills/weapons/sword.js';
import { rangerPetModifierRules } from '#gw2/professions/ranger/core/traits/pet-modifiers.js';
import { modifyRangerConditionBaseDuration } from '#gw2/professions/ranger/core/traits/skirmishing/attributes.js';

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
  modifyConditionBaseDuration: modifyRangerConditionBaseDuration,
  modifierRules: rangerCoreModifierRules
});
