import { GUARDIAN_SKILL_IDS } from "../../data/ids.js";
import { selectedGuardianSpecialization } from "../availability.js";
import { GUARDIAN_HANDLER_MECHANICS } from "../skill-mechanics.js";
import { handleRadiantWeaponEquipped } from "./traits.js";
import {
  emitGuardianEvent,
  handleScheduledStateEvent,
} from "../events.js";

function emitForgeWeaponSwap(context, skill, event = {}) {
  emitGuardianEvent(context, skill, "sigil_swap", {
    weaponSet: context.state.activeWeaponSet,
    mechanicSwap: true,
    ...event,
  });
}

export function validateRadiantForgeCast(context, skill) {
  if (skill.radiantForgeSkill) {
    return Boolean(context.state.profession.radiantForge);
  }
  if (skill.name === "Enter Radiant Forge") {
    return selectedGuardianSpecialization(context) === "Luminary"
      && !context.state.profession.radiantForge;
  }
  if (skill.name === "Exit Radiant Forge") {
    return selectedGuardianSpecialization(context) === "Luminary"
      && context.state.profession.radiantForge;
  }
}

function radiantForge(context, skill) {
  const entering = skill.name === "Enter Radiant Forge";
  if (!entering) {
    finalizeRadiantForgeCooldown(context, context.effectiveEnd);
  }
  context.state.profession.radiantForge = entering;
  context.state.profession.radiantForgeEndsAt =
    entering ? context.effectiveEnd + 20 : 0;
  context.state.profession.radiantForgeEnteredAt =
    entering ? context.effectiveEnd : 0;
  context.state.profession.radiantWeapon = "";
  if (entering) {
    context.state.profession.radiantWeaponsUsed = {};
  }
  if (!entering) context.state.profession.availableFlips = {};
  emitGuardianEvent(
    context,
    skill,
    entering ? "guardian.radiant-forge-entered" : "guardian.radiant-forge-exited",
  );
  emitForgeWeaponSwap(context, skill);
  return true;
}

function radiantWeapon(context, skill) {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return true;
  if (skill.id === GUARDIAN_SKILL_IDS.GLARING_BURST) {
    const coefficient =
      GUARDIAN_HANDLER_MECHANICS.radiantForge
        .glaringBurstCoefficientByWeapon[
          context.state.profession.radiantWeapon
        ] || 0;
    if (coefficient > 0) {
      context.emit({
        type: "damage",
        at: context.effectiveEnd,
        source: "guardian",
        sourceId: skill.id,
        actorType: "player",
        skillId: skill.id,
        skillName: skill.name,
        name: skill.name,
        coefficient,
        hits: 1,
        hitIndex: 1,
        totalHits: 1,
        skillWeapon: "",
        canCrit: true,
      });
    }
    return true;
  }
  if (skill.radiantWeapon && skill.flipParentId == null) {
    context.state.profession.radiantWeapon = skill.radiantWeapon;
    handleRadiantWeaponEquipped(context, skill);
    emitForgeWeaponSwap(context, skill);
  }
  if (
    skill.id === GUARDIAN_SKILL_IDS.DAZZLING_HAMMER
    && context.state.profession.radiantJusticeArmed
  ) {
    context.state.profession.radiantJusticeArmed = false;
    context.emit({
      type: "damage",
      at: context.effectiveEnd + 0.75,
      source: "guardian",
      sourceId: skill.id,
      actorType: "player",
      skillId: skill.id,
      skillName: skill.name,
      name: "Dazzling Hammer — Radiant Justice Impact",
      coefficient: 1.5,
      hits: 1,
      hitIndex: 1,
      totalHits: 1,
      skillWeapon: "",
      canCrit: true,
    });
    context.emit({
      type: "buff",
      at: context.effectiveEnd + 0.75,
      source: "guardian",
      sourceId: skill.id,
      actorType: "effect",
      skillId: skill.id,
      skillName: skill.name,
      kind: "target-vulnerability",
      stacks: 8,
      duration: 8,
    });
  }
  if (
    skill.id === GUARDIAN_SKILL_IDS.GLEAMING_BLADE
    && context.state.profession.radiantCourageSwordArmed
  ) {
    context.state.profession.radiantCourageSwordArmed = false;
    context.emit({
      type: "buff",
      at: context.effectiveEnd,
      source: "guardian",
      sourceId: GUARDIAN_SKILL_IDS.RADIANT_COURAGE,
      actorType: "player",
      skillId: GUARDIAN_SKILL_IDS.RADIANT_COURAGE,
      skillName: "Radiant Courage",
      kind: "guardian-radiant-courage-sword",
      stacks: 1,
      duration: 0.001,
    });
  }
  if (
    skill.id === GUARDIAN_SKILL_IDS.RADIANT_BULWARK
    && context.state.profession.radiantCourageShieldArmed
  ) {
    context.state.profession.radiantCourageShieldArmed = false;
  }
  return false;
}

function finalizeRadiantForgeCooldown(context, at) {
  const state = context.state.profession;
  const enter = context.catalog.skillsById.get(
    GUARDIAN_SKILL_IDS.ENTER_RADIANT_FORGE,
  );
  if (!enter || !state.radiantForge) return;
  const used = Object.keys(state.radiantWeaponsUsed || {})
    .filter(weapon =>
      ["hammer", "staff", "blade", "bulwark"].includes(weapon))
    .length;
  const unused = Math.max(0, 4 - used);
  const baseRecharge = Math.max(
    0,
    Number(enter.cooldown ?? enter.recharge ?? 10),
  );
  const adjustedBase = Math.max(5, baseRecharge - unused * 5);
  const fullEffective = context.rechargeDurationFor(
    enter,
    at,
  );
  const rechargeScale = baseRecharge > 0
    ? fullEffective / baseRecharge
    : 1;
  context.state.cooldowns.set(
    enter.id,
    at + adjustedBase * rechargeScale,
  );
}

export function clearRadiantForgeEntryCooldown(context, skill) {
  if (skill.id === GUARDIAN_SKILL_IDS.ENTER_RADIANT_FORGE) {
    context.state.cooldowns.delete(skill.id);
  }
}

export const guardianRadiantForgeSkillHandlers = Object.freeze({
  "guardian.radiant-forge": radiantForge,
  "guardian.radiant-weapon": radiantWeapon,
});

export const guardianRadiantForgeEventHandlers = Object.freeze({
  "guardian.radiant-forge-entered": handleScheduledStateEvent,
  "guardian.radiant-forge-exited": handleScheduledStateEvent,
});

export function advanceRadiantForgeState(context, target) {
  const state = context.state.profession;
  if (
    state.radiantForge
    && state.radiantForgeEndsAt <= target + context.epsilon
  ) {
    const expiredAt = state.radiantForgeEndsAt;
    finalizeRadiantForgeCooldown(context, expiredAt);
    const exit = context.catalog.skillsById.get(
      GUARDIAN_SKILL_IDS.EXIT_RADIANT_FORGE,
    );
    if (exit) {
      emitForgeWeaponSwap(context, exit, {
        at: expiredAt,
        automatic: true,
      });
    }
    state.radiantForge = false;
    state.radiantForgeEndsAt = 0;
    state.radiantForgeEnteredAt = 0;
    state.radiantWeapon = "";
    state.availableFlips = {};
  }
}
