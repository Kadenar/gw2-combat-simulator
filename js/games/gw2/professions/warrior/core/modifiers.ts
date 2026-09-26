import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { compileGw2ModifierRules, MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetHealthBelow } from '#gw2/platform/combat/query/runtime-query.js';
import type { Gw2Stats } from '#gw2/platform/combat/types.js';
import { modifyWarriorArmsAttributes, warriorArmsModifierRules } from '#gw2/professions/warrior/core/traits/arms.js';
import { warriorDefenseModifierRules } from '#gw2/professions/warrior/core/traits/defense.js';
import { warriorDisciplineModifierRules } from '#gw2/professions/warrior/core/traits/discipline.js';
import {
  warriorEventSkill,
  type WarriorModifierAttributes
} from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import {
  modifyWarriorStrengthAttributes,
  warriorStrengthModifierRules
} from '#gw2/professions/warrior/core/traits/strength.js';
import {
  modifyWarriorTacticsAttributes,
  warriorTacticsModifierRules
} from '#gw2/professions/warrior/core/traits/tactics.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';

function modifyWarriorAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const result = { ...attributes } as WarriorModifierAttributes;
  const staticRulesApplied = professionStaticRulesApplied(context.config);
  result.power = Number(result.power || 0);
  result.precision = Number(result.precision || 0);
  result.ferocity = Number(result.ferocity || 0);
  result.conditionDamage = Number(result.conditionDamage || 0);
  result.expertise = Number(result.expertise || 0);
  result.vitality = Number(result.vitality || 0);
  result.healingPower = Number(result.healingPower || 0);
  result.concentration = Number(result.concentration || 0);
  const gearPower = Number(context.config?.stats?.power || 0);
  // Compose line-owned fragments against one mutable result so conversions keep their original source pools.
  modifyWarriorStrengthAttributes(context, result, staticRulesApplied, gearPower);
  modifyWarriorTacticsAttributes(context, result, staticRulesApplied);
  modifyWarriorArmsAttributes(context, result, staticRulesApplied);

  return result;
}

const warriorModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'warrior.kill-shot-threshold',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.2,
    order: 100,
    // Kill Shot gets the same execute bonus from either a defiant target or live sub-50% health.
    when: (context) =>
      warriorEventSkill(context)?.id === ID.KILL_SHOT &&
      (context.config?.target?.defiant === true || targetHealthBelow(context, 0.5))
  },
  {
    id: 'warrior.throw-axe-health-threshold',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: {
      lowerThreshold: 0.25,
      upperThreshold: 0.5,
      lowerFactor: 2,
      upperFactor: 1.5
    } as Readonly<Record<string, number>>,
    factor: (context, _target, parameters) =>
      targetHealthBelow(context, parameters.lowerThreshold)
        ? parameters.lowerFactor
        : targetHealthBelow(context, parameters.upperThreshold)
          ? parameters.upperFactor
          : 1,
    order: 100,
    when: (context) => warriorEventSkill(context)?.id === ID.THROW_AXE
  },
  ...warriorStrengthModifierRules,
  ...warriorTacticsModifierRules,
  ...warriorDefenseModifierRules,
  ...warriorArmsModifierRules,
  {
    id: 'warrior.dagger-auto-critical-damage',
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: 'multiply',
    factor: 1.15,
    order: 100,
    when: (context) => {
      const skillId = Number(warriorEventSkill(context)?.id);
      return skillId === ID.PRECISE_CUT || skillId === ID.FOCUSED_SLASH;
    }
  },
  {
    id: 'warrior.wastrels-ruin-defiant',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 2,
    order: 100,
    when: (context) => warriorEventSkill(context)?.id === ID.WASTRELS_RUIN && context.config?.target?.defiant === true
  },
  {
    id: 'warrior.breaching-strike-boonless',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.5,
    order: 100,
    when: (context) => warriorEventSkill(context)?.id === ID.BREACHING_STRIKE
  },
  {
    id: 'warrior.slicing-maelstrom-boonless',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.5,
    order: 100,
    when: (context) => warriorEventSkill(context)?.id === ID.SLICING_MAELSTROM
  },
  ...warriorDisciplineModifierRules
]);

export const warriorCoreModifiers = Object.freeze({
  modifyAttributes: modifyWarriorAttributes,
  modifierRules: warriorModifierRules,
  compileModifierRules: compileGw2ModifierRules
});
