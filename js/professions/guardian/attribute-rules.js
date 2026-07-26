import { targetHasPermanentCondition } from "../../platform/gw2/target-state.js";
import {
  applyAdditiveDamageBucket,
} from "../../platform/gw2/damage-modifier-buckets.js";
import {
  GUARDIAN_SKILL_IDS,
  GUARDIAN_TRAIT_IDS,
} from "./data/ids.js";

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

function isOneHandedWeapon(weapon) {
  return Boolean(weapon) && ![
    "Greatsword",
    "Hammer",
    "Longbow",
    "Short Bow",
    "Spear",
    "Staff",
  ].includes(weapon);
}

function boonActive(context, boon) {
  if (context.config?.boons?.[boon]) return true;
  if (context.timeline?.timedActive(boon, context.time)) return true;
  if (
    boon === "resolution"
    && Number(context.runtime?.profession?.resolutionUntil || 0)
      > context.time
  ) return true;
  return (context.runtime?.boons?.get(boon) || []).some(application =>
    application.at <= context.time
    && application.expiresAt > context.time);
}

function timedBuffActive(context, kind) {
  return Boolean(context.timeline?.timedActive(kind, context.time));
}

function runtimeBuffActive(context, kind) {
  return (context.runtime?.boons?.get(kind) || []).some(application =>
    application.at <= context.time
    && application.expiresAt > context.time);
}

function latestTimedBuff(context, kind) {
  let latest = null;
  for (const event of context.events || []) {
    if (event.at > context.time) break;
    if (event.type === "buff" && event.kind === kind) latest = event;
  }
  return latest;
}

function targetDisabled(context) {
  if (
    context.config?.target?.disabled
    || context.config?.target?.defianceBroken
  ) return true;
  return (context.events || []).some(event =>
    event.type === "control"
    && event.at <= context.time
    && event.at + Math.max(0, Number(event.duration || 0)) > context.time);
}

function modifyGuardianAttributes(context, attributes) {
  const result = { ...attributes };
  const currentWeapon = activeWeapon(context);
  const staticWeapon = context.config?.guardianStaticTraitWeapon;
  const staticApplied = context.config?.guardianStaticTraitsApplied;
  if (hasTrait(context, GUARDIAN_TRAIT_IDS.ZEALOUS_BLADE)) {
    if (staticApplied) {
      result.power += (
        Number(currentWeapon === "Greatsword")
        - Number(staticWeapon === "Greatsword")
      ) * 120;
    } else {
      result.power += 120;
      if (currentWeapon === "Greatsword") result.power += 120;
    }
  }
  if (hasTrait(context, GUARDIAN_TRAIT_IDS.RIGHT_HAND_STRENGTH)) {
    if (staticApplied) {
      result.power += (
        Number(isOneHandedWeapon(currentWeapon))
        - Number(isOneHandedWeapon(staticWeapon))
      ) * 80;
    } else {
      result.precision += 80;
      if (isOneHandedWeapon(currentWeapon)) result.power += 80;
    }
  }
  if (
    !context.config?.guardianStaticTraitsApplied
    && hasTrait(context, GUARDIAN_TRAIT_IDS.RADIANT_POWER)
  ) {
    result.ferocity += 150;
  }
  if (hasTrait(context, GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS)) {
    result.conditionDamage += Number(result.vitality || 0) * 0.13;
  }
  return result;
}

function modifyGuardianCriticalChance(context, chance) {
  let result = chance;
  if (
    hasTrait(context, GUARDIAN_TRAIT_IDS.RADIANT_POWER)
    && targetHasCondition(context, "Burning")
  ) {
    result += 0.1;
  }
  if (
    hasTrait(context, GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS)
    && boonActive(context, "resolution")
  ) {
    result += 0.25;
  }
  return result;
}

function modifyGuardianStrikeDamage(context, multiplier) {
  let additiveBonus = 0;
  if (timedBuffActive(context, "guardian-empowered-armaments")) {
    additiveBonus += 0.1;
  }
  const radiantArmament = latestTimedBuff(
    context,
    "guardian-radiant-armaments",
  );
  if (
    radiantArmament?.radiantWeapon === "hammer"
    && radiantArmament.at + radiantArmament.duration > context.time
  ) {
    additiveBonus += 0.07;
  }
  if (
    hasTrait(context, GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS)
    && context.timeline?.furyActiveAt(context.time)
  ) {
    additiveBonus += 0.1;
  }
  if (
    hasTrait(context, GUARDIAN_TRAIT_IDS.RETRIBUTION)
    && boonActive(context, "resolution")
  ) {
    additiveBonus += 0.1;
  }
  if (
    hasTrait(context, GUARDIAN_TRAIT_IDS.SYMBOLIC_AVENGER)
    && Number(context.runtime?.profession?.symbolicAvengerUntil || 0)
      > context.time
  ) {
    additiveBonus += Math.min(
      5,
      Number(context.runtime.profession.symbolicAvengerStacks || 0),
    ) / 100;
  }
  if (timedBuffActive(context, "guardian-piercing-stance")) {
    additiveBonus += 0.1;
  }
  let result = applyAdditiveDamageBucket(context, multiplier, {
    bonus: additiveBonus,
  });
  if (
    hasTrait(context, GUARDIAN_TRAIT_IDS.FIERY_WRATH)
    && targetHasCondition(context, "Burning")
  ) {
    result *= 1.05;
  }
  if (
    hasTrait(context, GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE)
    && (
      context.timeline?.vulnerabilityStacksAt(context.time) > 0
      || runtimeBuffActive(context, "target-vulnerability")
    )
  ) {
    result *= 1.05;
  }
  if (timedBuffActive(context, "guardian-daring-advance")) {
    result *= 1.15;
  }
  if (
    context.event?.skillId === GUARDIAN_SKILL_IDS.SHINING_SPIN
    && targetDisabled(context)
  ) {
    result *= 1.2;
  }
  if (
    context.event?.skillId === GUARDIAN_SKILL_IDS.GLEAMING_BLADE
    && timedBuffActive(context, "guardian-radiant-courage-sword")
  ) {
    result *= 1.5;
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
