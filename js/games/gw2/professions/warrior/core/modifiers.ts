import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { warriorBurstSkillModifiers } from '#gw2/professions/warrior/core/skills/profession-skills.js';
import { warriorDaggerSkillModifiers } from '#gw2/professions/warrior/core/skills/weapons/dagger.js';

const warriorModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  ...warriorBurstSkillModifiers,
  ...warriorDaggerSkillModifiers
]);

export const warriorCoreModifiers = Object.freeze({
  modifierRules: warriorModifierRules
});
