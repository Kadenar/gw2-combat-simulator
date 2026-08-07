import { amalgamState } from "./state.js";
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

export function amalgamCastAvailability(
  context: EngineerPrecastContext,
  skill: EngineerSkill,
): AvailabilityResult {
  if (context.config.specialization !== "Amalgam") return { ready: true };
  const state = amalgamState.from(context);
  if (Number(state.plasmaticLockoutUntil || 0) > context.start) {
    return denyEngineerCast(
      skill,
      "engineer.plasmatic-aftercast",
      "Plasmatic State is completing its second packet.",
      state.plasmaticLockoutUntil,
    );
  }
  if (
    skill.categories?.includes("Morph")
    && !state.selectedMorphSkillIds.includes(Number(skill.id))
  ) {
    return denyEngineerCast(
      skill,
      "engineer.morph-selection",
      "another morph is selected for this profession slot.",
    );
  }
  return { ready: true };
}
