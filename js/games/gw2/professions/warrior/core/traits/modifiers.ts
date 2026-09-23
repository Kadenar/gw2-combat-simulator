import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';

import type { Gw2Stats } from '#gw2/platform/combat/types.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { compileGw2ModifierRules, MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { targetHealthBelow } from '#gw2/platform/combat/query/runtime-query.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { warriorCastAvailability } from '#gw2/professions/warrior/core/mechanics/availability.js';
import {
  warriorEventSkill,
  type WarriorModifierAttributes
} from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import {
  modifyWarriorArmsAttributes,
  modifyWarriorStrengthAttributes,
  modifyWarriorTacticsAttributes,
  warriorArmsModifierRules,
  warriorDefenseModifierRules,
  warriorDisciplineModifierRules,
  warriorStrengthModifierRules,
  warriorTacticsModifierRules
} from '#gw2/professions/warrior/core/traits/index.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { WarriorCastContext, WarriorSchedulerContext, WarriorSkill } from '#gw2/professions/warrior/types.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';

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

// Apply the fixed weapon-swap recharge and multiplicative burst or weapon-trait
// reductions after shared recharge policy has produced the base duration.
function modifyRechargeDuration(context: WarriorSchedulerContext & { skill?: WarriorSkill }, duration: number): number {
  const skill = context.skill;
  if (skill?.id === ID.SWAP_WEAPONS) return duration > 0 ? Math.min(5, duration) : 0;
  let result = duration;
  if (skill?.burst && hasTrait(context, TRAIT.VERSATILE_POWER))
    result *= balanceProfileNumber(
      requireBalanceProfileFromContext(context, TRAIT.VERSATILE_POWER),
      'rechargeMultiplier'
    );
  if (skill?.weapon === 'Greatsword' && hasTrait(context, TRAIT.FORCEFUL_GREATSWORD)) result *= 0.8;
  if (skill?.weapon === 'Sword' && hasTrait(context, TRAIT.BLADEMASTER)) result *= 0.8;
  if (skill?.weapon === 'Axe' && hasTrait(context, TRAIT.AXE_MASTERY))
    result *= balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.AXE_MASTERY), 'rechargeMultiplier');
  return result;
}

const DUAL_WIELD_OFFHANDS = new Set(['Axe', 'Dagger', 'Mace', 'Sword']);

function modifyCastDuration(context: WarriorCastContext, duration: number): number {
  // Only measured Dual Wielding timings replace the Quickness-calibrated cast duration.
  const measured = Number(context.skill.dualWieldCastTimeMs);
  if (!(measured > 0)) return duration;
  const weaponSet = context.state.activeWeaponSet === 2 ? 2 : 1;
  const offhand = String(gw2ConfiguredWeaponSet(context.config, weaponSet)[1] || '');
  return hasTrait(context, TRAIT.DUAL_WIELDING) && DUAL_WIELD_OFFHANDS.has(offhand) ? measured / 1000 : duration;
}

export const warriorCoreAttributeRules = Object.freeze({
  modifyAttributes: modifyWarriorAttributes,
  modifierRules: warriorModifierRules,
  compileModifierRules: compileGw2ModifierRules
});

export const warriorCoreCastRules = Object.freeze({
  availability: {
    id: 'warrior.resource',
    order: 10,
    handler: warriorCastAvailability
  },
  modifyCastDuration,
  modifyRechargeDuration
});
