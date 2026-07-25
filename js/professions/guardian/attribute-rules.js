import { targetHasPermanentCondition } from "../../platform/gw2/target-state.js";
import {
  GUARDIAN_SKILL_IDS,
  GUARDIAN_TRAIT_IDS,
} from "./ids.js";

function hasTrait(context, id) {
  if (context.traits?.has(id) || context.traits?.has(String(id))) return true;
  return [
    ...(context.config?.traitIds || []),
    ...(context.config?.selectedTraitIds || []),
    ...(context.config?.selectedTraits || []),
  ].some(value => value === id || String(value) === String(id));
}

function activeWeapon(context) {
  if (context.event?.skillWeapon) return context.event.skillWeapon;
  const weaponSet = context.timeline?.activeWeaponSetAt(context.time) || 1;
  return weaponSet === 2
    ? context.config?.weaponSet2Primary
    : context.config?.primaryWeapon;
}

function targetHasCondition(context, condition) {
  if (targetHasPermanentCondition(context.config || {}, condition)) return true;
  const applications =
    context.runtime?.conditionState?.get(condition)?.stacks || [];
  return applications.some(application =>
    application.appliedAt <= context.time
    && application.expiresAt > context.time
    && application.weight > 0);
}

function modifyGuardianAttributes(context, attributes) {
  const result = { ...attributes };
  if (hasTrait(context, GUARDIAN_TRAIT_IDS.ZEALOUS_BLADE)) {
    result.power += 120;
    if (activeWeapon(context) === "Greatsword") result.power += 120;
  }
  if (hasTrait(context, GUARDIAN_TRAIT_IDS.RADIANT_POWER)) {
    result.ferocity += 150;
  }
  if (hasTrait(context, GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS)) {
    result.conditionDamage += Number(result.vitality || 0) * 0.13;
  }
  return result;
}

function modifyGuardianCriticalChance(context, chance) {
  return (
    hasTrait(context, GUARDIAN_TRAIT_IDS.RADIANT_POWER)
    && targetHasCondition(context, "Burning")
  )
    ? chance + 0.1
    : chance;
}

function modifyGuardianStrikeDamage(context, multiplier) {
  let result = multiplier;
  if (
    hasTrait(context, GUARDIAN_TRAIT_IDS.FIERY_WRATH)
    && targetHasCondition(context, "Burning")
  ) {
    result *= 1.05;
  }
  if (
    hasTrait(context, GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS)
    && context.timeline?.furyActiveAt(context.time)
  ) {
    result *= 1.1;
  }
  return result;
}

function modifyGuardianConditionDamage(context, multiplier) {
  return (
    context.condition === "Burning"
    && hasTrait(context, GUARDIAN_TRAIT_IDS.AMPLIFIED_WRATH)
  )
    ? multiplier * 1.1
    : multiplier;
}

function modifyGuardianConditionDuration(context, multiplier) {
  if (context.condition !== "Burning") return multiplier;
  let result = multiplier;
  if (hasTrait(context, GUARDIAN_TRAIT_IDS.RADIANT_FIRE)) {
    result *= 1.2;
  }
  if (
    context.sourceId === "guardian.justice-passive"
    && hasTrait(context, GUARDIAN_TRAIT_IDS.AMPLIFIED_WRATH)
  ) {
    result *= 1.2;
  }
  return result;
}

function modifyGuardianRechargeDuration(context, duration) {
  const skill = context.skill;
  let result = duration;
  if (
    skill?.weapon === "Greatsword"
    && hasTrait(context, GUARDIAN_TRAIT_IDS.ZEALOUS_BLADE)
  ) {
    result *= 0.8;
  }
  if (
    skill?.weapon === "Torch"
    && hasTrait(context, GUARDIAN_TRAIT_IDS.RADIANT_FIRE)
  ) {
    result *= 0.8;
  }
  if (
    skill?.weapon === "Focus"
    && hasTrait(context, GUARDIAN_TRAIT_IDS.FOCUS_MASTERY)
  ) {
    result *= 0.8;
  }
  if (
    [
      GUARDIAN_SKILL_IDS.JUSTICE,
      GUARDIAN_SKILL_IDS.RESOLVE,
      GUARDIAN_SKILL_IDS.COURAGE,
    ].includes(skill?.id)
    && hasTrait(context, GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS)
  ) {
    result *= 0.85;
  }
  return result;
}

function modifyGuardianMaximumAmmo(context, maximum) {
  return (
    context.skill?.categories?.includes("SpiritWeapon")
    && hasTrait(context, GUARDIAN_TRAIT_IDS.ETERNAL_ARMORY)
  )
    ? maximum + 1
    : maximum;
}

export const guardianAttributeRules = Object.freeze({
  modifyAttributes: modifyGuardianAttributes,
  modifyCriticalChance: modifyGuardianCriticalChance,
  modifyStrikeDamage: modifyGuardianStrikeDamage,
  modifyConditionDamage: modifyGuardianConditionDamage,
  modifyConditionDuration: modifyGuardianConditionDuration,
});

export const guardianCastModifiers = Object.freeze({
  modifyRechargeDuration: modifyGuardianRechargeDuration,
  modifyMaximumAmmo: modifyGuardianMaximumAmmo,
});
