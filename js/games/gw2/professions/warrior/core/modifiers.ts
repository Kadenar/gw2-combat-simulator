import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { Gw2Stats } from '#gw2/platform/combat/stats.js';
import { warriorBurstSkillModifiers } from '#gw2/professions/warrior/core/skills/profession-skills.js';
import { modifySignetAttributes } from '#gw2/professions/warrior/core/skills/slot-skills.js';
import { warriorDaggerSkillModifiers } from '#gw2/professions/warrior/core/skills/weapons/dagger.js';
import { modifyWarriorArmsAttributes } from '#gw2/professions/warrior/core/traits/arms/index.js';
import type { WarriorModifierAttributes } from '#gw2/professions/warrior/core/traits/modifier-queries.js';

function modifyWarriorAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const result = { ...attributes } as WarriorModifierAttributes;
  result.power = result.power || 0;
  result.precision = result.precision || 0;
  result.ferocity = result.ferocity || 0;
  result.conditionDamage = result.conditionDamage || 0;
  result.expertise = result.expertise || 0;
  result.vitality = result.vitality || 0;
  result.healingPower = result.healingPower || 0;
  result.concentration = result.concentration || 0;
  // Already-granted effects retain their lifetime independently of selected trait contributions.

  modifyWarriorArmsAttributes(context, result);
  modifySignetAttributes(context, result);

  return result;
}

const warriorModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  ...warriorBurstSkillModifiers,
  ...warriorDaggerSkillModifiers
]);

export const warriorCoreModifiers = Object.freeze({
  modifyAttributes: modifyWarriorAttributes,
  modifierRules: warriorModifierRules
});
