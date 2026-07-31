import {
  professionCoreState,
  professionSpecializationState,
} from "../../../../platform/engine/profession.js";
/**
 * @fileoverview Implements Luminary Radiant Forge cast validation, mode
 * transitions, radiant-weapon effects, forge expiry, and resolver state
 * replay.
 */

import { GUARDIAN_SKILL_IDS } from "../../data/ids.js";
import { selectedGuardianSpecialization } from "../../core/availability.js";
import { LUMINARY_MECHANICS } from "./mechanics.js";
import { handleRadiantWeaponEquipped } from "./traits.js";
import { buildGuardianStrike, emitGuardianEvent } from "../../core/events.js";
import type {
  GuardianCastContext,
  GuardianEventContext,
  GuardianEventExtra,
  GuardianPrecastContext,
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianSchedulerContext,
  GuardianSkill,
} from "../../types.js";

/**
 * Emits the sigil-swap trigger caused by equipping a radiant weapon.
 *
 * @param {GuardianEventContext} context Scheduler callback context.
 * @param {GuardianSkill} skill Radiant weapon skill being equipped.
 * @param {GuardianEventExtra} [event] Additional event fields.
 * @returns {void}
 */
function emitForgeWeaponSwap(
  context: GuardianEventContext,
  skill: GuardianSkill,
  event: GuardianEventExtra = {},
): void {
  emitGuardianEvent(context, skill, "sigil_swap", {
    weaponSet: context.state.activeWeaponSet,
    mechanicSwap: true,
    ...event,
  });
}

/**
 * Emits a weapon-bar transition for entering or leaving Radiant Forge.
 *
 * @param {GuardianEventContext} context Scheduler callback context.
 * @param {GuardianSkill} skill Forge transition skill.
 * @param {GuardianEventExtra} [event] Additional event fields.
 * @returns {void}
 */
function emitForgeTransition(
  context: GuardianEventContext,
  skill: GuardianSkill,
  event: GuardianEventExtra = {},
): void {
  emitGuardianEvent(context, skill, "weapon_set", {
    weaponSet: context.state.activeWeaponSet,
    mechanicSwap: true,
    ...event,
  });
}

/**
 * Determines whether a forge transition or forge-only skill is currently
 * castable. Unrelated skills return no opinion.
 *
 * @param {GuardianPrecastContext} context Cast-validation context.
 * @param {GuardianSkill} skill Candidate skill.
 * @returns {boolean|undefined} Whether the relevant forge skill is castable.
 */
export function validateRadiantForgeCast(
  context: GuardianPrecastContext,
  skill: GuardianSkill,
): boolean | undefined {
  if (skill.type === "Weapon" && professionSpecializationState(context, "Luminary").radiantForge) {
    return false;
  }
  if (skill.radiantForgeSkill) {
    return Boolean(professionSpecializationState(context, "Luminary").radiantForge);
  }
  if (skill.name === "Enter Radiant Forge") {
    return (
      selectedGuardianSpecialization(context) === "Luminary" &&
      !professionSpecializationState(context, "Luminary").radiantForge
    );
  }
  if (skill.name === "Exit Radiant Forge") {
    return (
      selectedGuardianSpecialization(context) === "Luminary" &&
      professionSpecializationState(context, "Luminary").radiantForge
    );
  }
}

/**
 * Enters or exits Radiant Forge and emits the corresponding state and
 * weapon-bar transition events.
 *
 * @param {GuardianCastContext} context Skill-handler context.
 * @param {GuardianSkill} skill Enter or Exit Radiant Forge.
 * @returns {boolean} Always true because this replacing handler owns the cast.
 */
function radiantForge(
  context: GuardianCastContext,
  skill: GuardianSkill,
): boolean {
  const entering = skill.name === "Enter Radiant Forge";
  const state = professionSpecializationState(context, "Luminary");
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
  if (!entering) professionCoreState(context).availableFlips = {};
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

/**
 * Applies state changes and conditional virtue bonuses after a radiant weapon
 * finishes casting.
 *
 * @param {GuardianCastContext} context Skill-handler context.
 * @param {GuardianSkill} skill Radiant weapon or radiant weapon flip skill.
 * @returns {boolean} True for interrupted casts; otherwise false so declared
 * effects remain authoritative.
 */
function radiantWeapon(
  context: GuardianCastContext,
  skill: GuardianSkill,
): boolean {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return true;
  if (skill.radiantWeapon && skill.flipParentId == null) {
    professionSpecializationState(context, "Luminary").radiantWeapon = skill.radiantWeapon;
    handleRadiantWeaponEquipped(context, skill);
    emitForgeWeaponSwap(context, skill);
  }
  if (
    skill.id === GUARDIAN_SKILL_IDS.DAZZLING_HAMMER &&
    professionSpecializationState(context, "Luminary").radiantJusticeArmed
  ) {
    professionSpecializationState(context, "Luminary").radiantJusticeArmed = false;
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
    professionSpecializationState(context, "Luminary").radiantCourageSwordArmed
  ) {
    professionSpecializationState(context, "Luminary").radiantCourageSwordArmed = false;
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
    professionSpecializationState(context, "Luminary").radiantCourageShieldArmed
  ) {
    professionSpecializationState(context, "Luminary").radiantCourageShieldArmed = false;
  }
  return false;
}

/**
 * Emits Glaring Burst's weapon-dependent replacement strike.
 *
 * @param {GuardianCastContext} context Skill-handler context.
 * @param {GuardianSkill} skill Glaring Burst skill definition.
 * @returns {void}
 */
function glaringBurst(
  context: GuardianCastContext,
  skill: GuardianSkill,
): void {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;
  const radiantWeapon = professionSpecializationState(context, "Luminary").radiantWeapon;
  const coefficient = radiantWeapon === "hammer" || radiantWeapon === "blade"
    ? LUMINARY_MECHANICS.radiantForge
      .glaringBurstCoefficientByWeapon[radiantWeapon]
    : 0;
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

/**
 * Replaces Radiant Forge's provisional recharge with the final recharge based
 * on how many distinct radiant weapons were used during the entry.
 *
 * @param {GuardianSchedulerContext} context Scheduler context.
 * @param {number} at Simulation time when the forge ends.
 * @returns {void}
 */
function finalizeRadiantForgeCooldown(
  context: GuardianSchedulerContext,
  at: number,
): void {
  const state = professionSpecializationState(context, "Luminary");
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

/**
 * Clears the cooldown created at forge entry so it can begin when the forge
 * actually ends.
 *
 * @param {GuardianCastContext} context Cast-completion hook context.
 * @param {GuardianSkill} skill Completed skill.
 * @returns {void}
 */
export function clearRadiantForgeEntryCooldown(
  context: GuardianCastContext,
  skill: GuardianSkill,
): void {
  if (skill.id === GUARDIAN_SKILL_IDS.ENTER_RADIANT_FORGE) {
    context.state.cooldowns.delete(skill.id);
  }
}

/**
 * Raw Radiant Forge callbacks consumed by the central handler registry.
 */
export const guardianRadiantForgeSkillHandlers = Object.freeze({
  "guardian.radiant-forge": radiantForge,
  "guardian.radiant-weapon": radiantWeapon,
  "guardian.glaring-burst": glaringBurst,
});

/**
 * Replays a scheduler forge transition into chronological resolver state.
 *
 * @param {GuardianResolverContext} context Resolver event-handler context.
 * @param {GuardianResolverEvent} event Forge-entered or forge-exited timeline
 * event.
 * @returns {void}
 */
function handleRadiantForgeTransition(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
): void {
  professionSpecializationState(context, "Luminary").radiantForge = Boolean(event.radiantForge);
  professionSpecializationState(context, "Luminary").radiantForgeEndsAt = Number(event.radiantForgeEndsAt || 0);
  professionSpecializationState(context, "Luminary").radiantForgeEnteredAt = Number(
    event.radiantForgeEnteredAt || 0,
  );
  professionSpecializationState(context, "Luminary").radiantWeapon = String(event.radiantWeapon || "");
  if (!professionSpecializationState(context, "Luminary").radiantForge) {
    professionCoreState(context).availableFlips = {};
  }
}

/**
 * Resolver handlers for Radiant Forge timeline events.
 */
export const guardianRadiantForgeEventHandlers = Object.freeze({
  "guardian.radiant-forge-entered": handleRadiantForgeTransition,
  "guardian.radiant-forge-exited": handleRadiantForgeTransition,
});

/**
 * Expires Radiant Forge when scheduler time advances past its end, finalizes
 * its cooldown, and emits the automatic exit transition.
 *
 * @param {GuardianSchedulerContext} context Scheduler advancement context.
 * @param {number} target Target simulation time.
 * @returns {void}
 */
export function advanceRadiantForgeState(
  context: GuardianSchedulerContext,
  target: number,
): void {
  const state = professionSpecializationState(context, "Luminary");
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
    professionCoreState(context).availableFlips = {};
  }
}
