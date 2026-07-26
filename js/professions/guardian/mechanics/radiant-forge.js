import { GUARDIAN_SKILL_IDS } from "../data/ids.js";
import { selectedGuardianSpecialization } from "./availability.js";
import { GUARDIAN_HANDLER_MECHANICS } from "./skill-mechanics.js";
import {
  emitGuardianEvent,
  handleScheduledStateEvent,
} from "./events.js";

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
  context.state.profession.radiantForge = entering;
  context.state.profession.radiantForgeEndsAt =
    entering ? context.effectiveEnd + 20 : 0;
  context.state.profession.radiantWeapon = "";
  if (!entering) context.state.profession.availableFlips = {};
  emitGuardianEvent(
    context,
    skill,
    entering ? "guardian.radiant-forge-entered" : "guardian.radiant-forge-exited",
  );
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
  if (skill.radiantWeapon) {
    context.state.profession.radiantWeapon = skill.radiantWeapon;
  }
  return false;
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
    state.radiantForge = false;
    state.radiantForgeEndsAt = 0;
    state.radiantWeapon = "";
    state.availableFlips = {};
  }
}
