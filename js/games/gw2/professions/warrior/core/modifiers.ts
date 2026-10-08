import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { Gw2Stats } from '#gw2/platform/combat/stats.js';
import { warriorBurstSkillModifiers } from '#gw2/professions/warrior/core/skills/profession-skills.js';
import { modifySignetAttributes } from '#gw2/professions/warrior/core/skills/slot-skills.js';
import { warriorDaggerSkillModifiers } from '#gw2/professions/warrior/core/skills/weapons/dagger.js';
import { modifyWarriorArmsAttributes } from '#gw2/professions/warrior/core/traits/arms/index.js';
import type { WarriorModifierAttributes } from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import { modifyWarriorStrengthAttributes } from '#gw2/professions/warrior/core/traits/strength/index.js';
import { modifyWarriorTacticsAttributes } from '#gw2/professions/warrior/core/traits/tactics/index.js';

function modifyWarriorAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const result = { ...attributes } as WarriorModifierAttributes;
  const staticRulesApplied = professionStaticRulesApplied(context.config);
  result.power = result.power || 0;
  result.precision = result.precision || 0;
  result.ferocity = result.ferocity || 0;
  result.conditionDamage = result.conditionDamage || 0;
  result.expertise = result.expertise || 0;
  result.vitality = result.vitality || 0;
  result.healingPower = result.healingPower || 0;
  result.concentration = result.concentration || 0;
  const gearPower = context.config?.stats?.power || 0;
  // Compose line-owned fragments against one mutable result so conversions keep their original source pools.
  modifyWarriorStrengthAttributes(context, result, staticRulesApplied, gearPower);
  modifyWarriorTacticsAttributes(context, result, staticRulesApplied);
  modifyWarriorArmsAttributes(context, result, staticRulesApplied);
  modifySignetAttributes(context, result, staticRulesApplied);

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
