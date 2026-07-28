import { targetHasPermanentCondition } from "../../platform/gw2/target-state.js";
import {
  createModifierHooks,
  MODIFIER_TARGET,
} from "../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../platform/gw2/trait-state.js";
import {
  GUARDIAN_SKILL_IDS,
  GUARDIAN_TRAIT_IDS,
} from "./data/ids.js";

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

export const guardianModifierRules = Object.freeze([
  {
    id: "guardian.radiant-power-critical-chance",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: 0.1,
    when: context =>
      hasTrait(context, GUARDIAN_TRAIT_IDS.RADIANT_POWER)
      && targetHasCondition(context, "Burning"),
  },
  {
    id: "guardian.righteous-instincts",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: 0.25,
    when: context =>
      hasTrait(context, GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS)
      && boonActive(context, "resolution"),
  },
  {
    id: "guardian.empowered-armaments",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.1,
    when: context =>
      timedBuffActive(context, "guardian-empowered-armaments"),
  },
  {
    id: "guardian.radiant-armaments",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.07,
    when: context => {
      const armament = latestTimedBuff(
        context,
        "guardian-radiant-armaments",
      );
      return (
        armament?.radiantWeapon === "hammer"
        && armament.at + armament.duration > context.time
      );
    },
  },
  {
    id: "guardian.furious-focus",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.1,
    when: context =>
      hasTrait(context, GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS)
      && context.timeline?.furyActiveAt(context.time),
  },
  {
    id: "guardian.retribution",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.1,
    when: context =>
      hasTrait(context, GUARDIAN_TRAIT_IDS.RETRIBUTION)
      && boonActive(context, "resolution"),
  },
  {
    id: "guardian.symbolic-avenger",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: context =>
      Math.min(
        5,
        Number(context.runtime?.profession?.symbolicAvengerStacks || 0),
      ) / 100,
    when: context =>
      hasTrait(context, GUARDIAN_TRAIT_IDS.SYMBOLIC_AVENGER)
      && Number(context.runtime?.profession?.symbolicAvengerUntil || 0)
        > context.time,
  },
  {
    id: "guardian.piercing-stance",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.1,
    when: context =>
      timedBuffActive(context, "guardian-piercing-stance"),
  },
  {
    id: "guardian.fiery-wrath",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.05,
    order: 100,
    when: context =>
      hasTrait(context, GUARDIAN_TRAIT_IDS.FIERY_WRATH)
      && targetHasCondition(context, "Burning"),
  },
  {
    id: "guardian.symbolic-exposure",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.05,
    order: 100,
    when: context =>
      hasTrait(context, GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE)
      && (
        context.timeline?.vulnerabilityStacksAt(context.time) > 0
        || runtimeBuffActive(context, "target-vulnerability")
      ),
  },
  {
    id: "guardian.daring-advance",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.15,
    order: 100,
    when: context =>
      timedBuffActive(context, "guardian-daring-advance"),
  },
  {
    id: "guardian.shining-spin",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.2,
    order: 100,
    when: context =>
      context.event?.skillId === GUARDIAN_SKILL_IDS.SHINING_SPIN
      && targetDisabled(context),
  },
  {
    id: "guardian.glaring-burst-hammer",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.25,
    order: 100,
    when: context =>
      context.event?.skillId === GUARDIAN_SKILL_IDS.GLARING_BURST
      && context.event?.radiantWeapon === "hammer",
  },
  {
    id: "guardian.gleaming-blade",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.5,
    order: 100,
    when: context =>
      context.event?.skillId === GUARDIAN_SKILL_IDS.GLEAMING_BLADE
      && timedBuffActive(context, "guardian-radiant-courage-sword"),
  },
  {
    id: "guardian.amplified-wrath-damage",
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: "multiply",
    factor: 1.1,
    when: context =>
      context.condition === "Burning"
      && hasTrait(context, GUARDIAN_TRAIT_IDS.AMPLIFIED_WRATH),
  },
  {
    id: "guardian.radiant-fire-duration",
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: "multiply",
    factor: 1.2,
    when: context =>
      context.condition === "Burning"
      && hasTrait(context, GUARDIAN_TRAIT_IDS.RADIANT_FIRE),
  },
  {
    id: "guardian.justice-passive-duration",
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: "multiply",
    factor: 1.2,
    when: context =>
      context.condition === "Burning"
      && context.sourceId === "guardian.justice-passive"
      && hasTrait(context, GUARDIAN_TRAIT_IDS.AMPLIFIED_WRATH),
  },
]);

const guardianModifierHooks = createModifierHooks({
  rules: guardianModifierRules,
});

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

function modifyGuardianCastDuration(context, duration) {
  if (
    context.skill?.id !== GUARDIAN_SKILL_IDS.DAYBREAKING_SLASH
    || !context.hasBuff?.("quickness", context.start)
  ) {
    return duration;
  }
  return Number(
    context.state?.profession?.daybreakingSlashChainStep || 0,
  ) === 0
    ? 0.52
    : 0.44;
}

export const guardianAttributeRules = Object.freeze({
  modifyAttributes: modifyGuardianAttributes,
  ...guardianModifierHooks,
});

export const guardianCastModifiers = Object.freeze({
  modifyCastDuration: modifyGuardianCastDuration,
  modifyRechargeDuration: modifyGuardianRechargeDuration,
  modifyMaximumAmmo: modifyGuardianMaximumAmmo,
});
