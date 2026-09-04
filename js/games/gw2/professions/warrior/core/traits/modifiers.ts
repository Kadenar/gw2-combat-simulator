import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { createModifierHooks, MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { targetHealthFraction } from '#gw2/platform/combat/query/runtime-query.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { warriorCastAvailability } from '#gw2/professions/warrior/core/mechanics/availability.js';
import {
  warriorEventSkill,
  type WarriorModifierAttributes
} from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import {
  advanceWarriorTraits,
  applyWarriorWeaponSwapTraits,
  beginWarriorSkill,
  completeWarriorSkill,
  handleWarriorArmsCriticalTask,
  initializeWarriorTraits,
  modifyWarriorArmsAttributes,
  modifyWarriorStrengthAttributes,
  modifyWarriorTacticsAttributes,
  observeWarriorEvent,
  warriorArmsModifierRules,
  warriorDefenseModifierRules,
  warriorDisciplineModifierRules,
  warriorStrengthModifierRules,
  warriorTacticsModifierRules
} from '#gw2/professions/warrior/core/traits/index.js';
import { advanceWarriorResources } from '#gw2/professions/warrior/core/mechanics/adrenaline-and-endurance.js';
import { handleWarriorAdrenalineTask } from '#gw2/professions/warrior/resources.js';
import type { SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import type { WarriorCastContext, WarriorSchedulerContext, WarriorSkill } from '#gw2/professions/warrior/types.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';

export { snapshotWarriorState } from '#gw2/professions/warrior/state.js';

function modifyWarriorAttributes(context: Gw2ModifierContext, attributes: SchedulerRecord): SchedulerRecord {
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
  modifyWarriorTacticsAttributes(context, result, staticRulesApplied, gearPower);
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
      (context.config?.target?.defiant === true || targetHealthFraction(context) < 0.5)
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
      targetHealthFraction(context) <= parameters.lowerThreshold
        ? parameters.lowerFactor
        : targetHealthFraction(context) <= parameters.upperThreshold
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
    when: (context) =>
      warriorEventSkill(context)?.id === ID.BREACHING_STRIKE && context.config?.target?.boonless === true
  },
  {
    id: 'warrior.slicing-maelstrom-boonless',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.5,
    order: 100,
    when: (context) =>
      warriorEventSkill(context)?.id === ID.SLICING_MAELSTROM && context.config?.target?.boonless === true
  },
  ...warriorDisciplineModifierRules
]);

// Apply the fixed weapon-swap recharge and multiplicative burst or weapon-trait
// reductions after shared recharge policy has produced the base duration.
function modifyRechargeDuration(context: WarriorSchedulerContext & { skill?: WarriorSkill }, duration: number): number {
  const skill = context.skill;
  if (skill?.id === ID.SWAP_WEAPONS) return duration > 0 ? 5 : 0;
  let result = duration;
  if (skill?.burst && hasTrait(context, TRAIT.VERSATILE_POWER)) result *= 0.85;
  if (skill?.weapon === 'Greatsword' && hasTrait(context, TRAIT.FORCEFUL_GREATSWORD)) result *= 0.8;
  if (skill?.weapon === 'Sword' && hasTrait(context, TRAIT.BLADEMASTER)) result *= 0.8;
  if (skill?.weapon === 'Axe' && hasTrait(context, TRAIT.AXE_MASTERY)) result *= 0.8;
  return result;
}

const DUAL_WIELD_OFFHANDS = new Set(['Axe', 'Dagger', 'Mace', 'Sword']);
const DUAL_WIELDING_EXCLUDED_SKILL_IDS = new Set<number>([
  ID.AURA_SLICER,
  ID.KICK,
  ID.BULLS_CHARGE,
  ID.BREACHING_STRIKE
]);
/** GW2 completes cast durations on 40 ms action-tick boundaries. */
const ACTION_TICK_MS = 40;

// Dual Wielding increases attack speed by 25%, so cast duration is divided by
// 1.25. The tick snap must happen once, on the final duration: the game applies
// every attack-speed modifier (Quickness included) and only then rounds to the
// nearest action tick. Rounding the Quickness duration first — as the shared
// scheduler does — then dividing here would double-round and run long.
function roundToActionTick(durationSeconds: number): number {
  return (Math.round((durationSeconds * 1000) / ACTION_TICK_MS) * ACTION_TICK_MS) / 1000;
}

function modifyCastDuration(context: WarriorCastContext, duration: number): number {
  const skill = context.skill;
  const weaponSet = context.state.activeWeaponSet === 2 ? 2 : 1;
  const offhand = String(gw2ConfiguredWeaponSet(context.config, weaponSet)[1] || '');
  const measured = Number(skill.dualWieldCastTimeMs || 0);
  const dualWielding =
    hasTrait(context, TRAIT.DUAL_WIELDING) &&
    DUAL_WIELD_OFFHANDS.has(offhand) &&
    !DUAL_WIELDING_EXCLUDED_SKILL_IDS.has(Number(skill.id)) &&
    (skill.type === 'Weapon' ||
      skill.type === 'Utility' ||
      Boolean(skill.weapon) ||
      Boolean(skill.burst) ||
      measured > 0);
  if (!dualWielding) return duration;
  // A measured Dual Wielding cast (captured under Quickness) is used verbatim;
  // the 1.25 divide is only a fallback for skills without a measured value.
  if (measured > 0 && context.hasBuff('quickness', context.start)) {
    return measured / 1000;
  }

  return roundToActionTick(duration / 1.25);
}

export const warriorCoreAttributeRules = Object.freeze({
  modifyAttributes: modifyWarriorAttributes,
  modifierRules: warriorModifierRules,
  compileModifierRules: (rules: readonly Gw2ModifierRule[]) => createModifierHooks({ rules })
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

export const warriorCoreSchedulerHooks = Object.freeze({
  initialize: initializeWarriorTraits,
  onCastStart: beginWarriorSkill,
  // Core weapon-swap traits extend the shared transition through one hook.
  onWeaponSwap: applyWarriorWeaponSwapTraits,
  advance: {
    id: 'warrior.core-resources-and-traits',
    order: 10,
    handler: (context: WarriorSchedulerContext, target: number) => {
      advanceWarriorResources(context, target);
      advanceWarriorTraits(context, target);
    }
  },
  onEventScheduled: {
    id: 'warrior.adrenaline',
    order: 10,
    handler: observeWarriorEvent
  },
  onCastComplete: {
    id: 'warrior.core-skill-completion',
    order: 10,
    handler: completeWarriorSkill
  },
  taskHandlers: Object.freeze({
    'warrior.adrenaline-hit': handleWarriorAdrenalineTask,
    'warrior.arms-critical': handleWarriorArmsCriticalTask
  })
});
