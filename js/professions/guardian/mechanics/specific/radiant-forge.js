import { GUARDIAN_SKILL_IDS } from "../../data/ids.js";
import { selectedGuardianSpecialization } from "../availability.js";
import { GUARDIAN_HANDLER_MECHANICS } from "../handler-mechanics.js";
import { handleRadiantWeaponEquipped } from "./traits.js";
import { buildGuardianStrike, emitGuardianEvent } from "../events.js";

function emitForgeWeaponSwap(context, skill, event = {}) {
  emitGuardianEvent(context, skill, "sigil_swap", {
    weaponSet: context.state.activeWeaponSet,
    mechanicSwap: true,
    ...event,
  });
}

function emitForgeTransition(context, skill, event = {}) {
  emitGuardianEvent(context, skill, "weapon_set", {
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
    return (
      selectedGuardianSpecialization(context) === "Luminary" &&
      !context.state.profession.radiantForge
    );
  }
  if (skill.name === "Exit Radiant Forge") {
    return (
      selectedGuardianSpecialization(context) === "Luminary" &&
      context.state.profession.radiantForge
    );
  }
}

function radiantForge(context, skill) {
  const entering = skill.name === "Enter Radiant Forge";
  const state = context.state.profession;
  if (!entering) {
    finalizeRadiantForgeCooldown(context, context.effectiveEnd);
  }
  state.radiantForge = entering;
  state.radiantForgeEndsAt = entering ? context.effectiveEnd + 20 : 0;
  state.radiantForgeEnteredAt = entering ? context.effectiveEnd : 0;
  state.radiantWeapon = "";
  if (entering) {
    state.radiantWeaponsUsed = {};
  }
  if (!entering) state.availableFlips = {};
  emitGuardianEvent(
    context,
    skill,
    entering
      ? "guardian.radiant-forge-entered"
      : "guardian.radiant-forge-exited",
    {
      radiantForge: state.radiantForge,
      radiantForgeEndsAt: state.radiantForgeEndsAt,
      radiantForgeEnteredAt: state.radiantForgeEnteredAt,
      radiantWeapon: state.radiantWeapon,
    },
  );
  emitForgeTransition(context, skill);
  return true;
}

function radiantWeapon(context, skill) {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return true;
  if (skill.radiantWeapon && skill.flipParentId == null) {
    context.state.profession.radiantWeapon = skill.radiantWeapon;
    handleRadiantWeaponEquipped(context, skill);
    emitForgeWeaponSwap(context, skill);
  }
  if (
    skill.id === GUARDIAN_SKILL_IDS.DAZZLING_HAMMER &&
    context.state.profession.radiantJusticeArmed
  ) {
    context.state.profession.radiantJusticeArmed = false;
    context.emit(
      buildGuardianStrike({
        at: context.effectiveEnd + 0.75,
        sourceId: skill.id,
        skillId: skill.id,
        skillName: skill.name,
        name: "Dazzling Hammer — Radiant Justice Impact",
        coefficient: 1.5,
      }),
    );
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
    skill.id === GUARDIAN_SKILL_IDS.GLEAMING_BLADE &&
    context.state.profession.radiantCourageSwordArmed
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
    skill.id === GUARDIAN_SKILL_IDS.RADIANT_BULWARK &&
    context.state.profession.radiantCourageShieldArmed
  ) {
    context.state.profession.radiantCourageShieldArmed = false;
  }
  return false;
}

function glaringBurst(context, skill) {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;
  const coefficient =
    GUARDIAN_HANDLER_MECHANICS.radiantForge.glaringBurstCoefficientByWeapon[
      context.state.profession.radiantWeapon
    ] || 0;
  const radiantWeapon = context.state.profession.radiantWeapon;
  if (coefficient <= 0) return;
  context.emit(
    buildGuardianStrike({
      at: context.effectiveEnd,
      sourceId: skill.id,
      skillId: skill.id,
      skillName: skill.name,
      name: skill.name,
      coefficient,
      radiantWeapon,
    }),
  );
}

function finalizeRadiantForgeCooldown(context, at) {
  const state = context.state.profession;
  const enter = context.catalog.skillsById.get(
    GUARDIAN_SKILL_IDS.ENTER_RADIANT_FORGE,
  );
  if (!enter || !state.radiantForge) return;
  const used = Object.keys(state.radiantWeaponsUsed || {}).filter((weapon) =>
    ["hammer", "staff", "blade", "bulwark"].includes(weapon),
  ).length;
  const unused = Math.max(0, 4 - used);
  const baseRecharge = Math.max(
    0,
    Number(enter.cooldown ?? enter.recharge ?? 10),
  );
  const adjustedBase = Math.max(5, baseRecharge - unused * 5);
  const fullEffective = context.rechargeDurationFor(enter, at);
  const rechargeScale = baseRecharge > 0 ? fullEffective / baseRecharge : 1;
  context.state.cooldowns.set(enter.id, at + adjustedBase * rechargeScale);
}

export function clearRadiantForgeEntryCooldown(context, skill) {
  if (skill.id === GUARDIAN_SKILL_IDS.ENTER_RADIANT_FORGE) {
    context.state.cooldowns.delete(skill.id);
  }
}

export const guardianRadiantForgeSkillHandlers = Object.freeze({
  "guardian.radiant-forge": radiantForge,
  "guardian.radiant-weapon": radiantWeapon,
  "guardian.glaring-burst": glaringBurst,
});

function handleRadiantForgeTransition(context, event) {
  context.profession.radiantForge = Boolean(event.radiantForge);
  context.profession.radiantForgeEndsAt = Number(event.radiantForgeEndsAt || 0);
  context.profession.radiantForgeEnteredAt = Number(
    event.radiantForgeEnteredAt || 0,
  );
  context.profession.radiantWeapon = String(event.radiantWeapon || "");
  if (!context.profession.radiantForge) {
    context.profession.availableFlips = {};
  }
}

export const guardianRadiantForgeEventHandlers = Object.freeze({
  "guardian.radiant-forge-entered": handleRadiantForgeTransition,
  "guardian.radiant-forge-exited": handleRadiantForgeTransition,
});

export function advanceRadiantForgeState(context, target) {
  const state = context.state.profession;
  if (
    state.radiantForge &&
    state.radiantForgeEndsAt <= target + context.epsilon
  ) {
    const expiredAt = state.radiantForgeEndsAt;
    finalizeRadiantForgeCooldown(context, expiredAt);
    const exit = context.catalog.skillsById.get(
      GUARDIAN_SKILL_IDS.EXIT_RADIANT_FORGE,
    );
    if (exit) {
      emitGuardianEvent(context, exit, "guardian.radiant-forge-exited", {
        at: expiredAt,
        automatic: true,
        radiantForge: false,
        radiantForgeEndsAt: 0,
        radiantForgeEnteredAt: 0,
        radiantWeapon: "",
      });
      emitForgeTransition(context, exit, {
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
