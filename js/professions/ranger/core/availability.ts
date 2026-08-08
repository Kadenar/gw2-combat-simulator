import { flattenProfessionState } from "../../../platform/engine/profession.js";
import type { AvailabilityResult } from "../../../platform/engine/types.js";
import type { RangerPrecastContext, RangerSkill } from "../types.js";
import {
  isRangerHammerVariant,
  normalizeRangerHammerSkillIds,
} from "./hammer.js";

function deny(
  skill: RangerSkill,
  code: string,
  cause: string,
): AvailabilityResult {
  return {
    ready: false,
    code,
    reason: `${skill.name} is unavailable - ${cause}`,
  };
}

export function rangerCoreCastAvailability(
  context: RangerPrecastContext,
  skill: RangerSkill,
): AvailabilityResult {
  if (
    isRangerHammerVariant(skill.id) &&
    !normalizeRangerHammerSkillIds(
      context.config.selectedHammerSkillIds,
    ).includes(Number(skill.id))
  ) {
    return deny(
      skill,
      "ranger.hammer-variant-not-selected",
      "select this Hammer variant first.",
    );
  }
  if (!skill.petSkill) return { ready: true };
  const state = flattenProfessionState(context.state.profession);
  if (state.beastmodeActive) {
    return deny(skill, "ranger.pet-merged", "leave Beastmode first.");
  }
  if (!((state.activePetSkillIds as unknown[]) || []).includes(skill.id)) {
    return deny(
      skill,
      "ranger.inactive-pet",
      "select the pet that owns this Beast skill.",
    );
  }
  return { ready: true };
}
