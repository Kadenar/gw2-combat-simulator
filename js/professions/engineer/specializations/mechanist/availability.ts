import {
  denyEngineerCast,
} from "../../core/availability.js";
import type {
  AvailabilityResult,
} from "../../../../platform/engine/types.js";
import type {
  EngineerPrecastContext,
  EngineerSkill,
} from "../../types.js";

export function mechanistCastAvailability(
  context: EngineerPrecastContext,
  skill: EngineerSkill,
): AvailabilityResult {
  if (context.config.specialization !== "Mechanist") return { ready: true };
  const state = context.state.profession;
  if (skill.toolbeltParentName) {
    return denyEngineerCast(
      skill,
      "engineer.toolbelt-replaced",
      "Mechanist mech commands replace tool-belt skills.",
    );
  }
  if (skill.mechanicSlot) {
    const slot = Number(skill.mechanicSlot);
    if (slot <= 3 && !state.mech.commandSkillIds.includes(skill.id)) {
      return denyEngineerCast(
        skill,
        "engineer.mech-command",
        "a selected Mechanist trait supplies a different command.",
      );
    }
    if (slot <= 3 && !state.mech.active) {
      return denyEngineerCast(
        skill,
        "engineer.mech-inactive",
        "summon the jade mech first.",
      );
    }
    if (skill.name === "Crash Down" && state.mech.active) {
      return denyEngineerCast(
        skill,
        "engineer.mech-active",
        "the jade mech is already active.",
      );
    }
    if (skill.name.startsWith("Recall Mech") && !state.mech.active) {
      return denyEngineerCast(
        skill,
        "engineer.mech-inactive",
        "the jade mech is not active.",
      );
    }
  }
  return { ready: true };
}
