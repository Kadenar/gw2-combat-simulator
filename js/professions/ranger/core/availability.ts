import {
  flattenProfessionState,
  professionCoreState,
} from "../../../platform/engine/profession.js";
import { RANGER_SKILL_IDS as ID } from "../data/ids.js";
import type { AvailabilityResult } from "../../../platform/engine/types.js";
import type { RangerPrecastContext, RangerSkill } from "../types.js";
import {
  isRangerHammerVariant,
  normalizeRangerHammerSkillIds,
} from "./hammer.js";
import { rangerEnduranceReadyAt } from "./resources.js";

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
  if (skill.id === ID.DODGE) {
    return professionCoreState(context).endurance + context.epsilon >= 50
      ? { ready: true }
      : {
          ready: false,
          retryAt: rangerEnduranceReadyAt(context, 50),
          code: "ranger.endurance",
          reason: "Dodge requires 50 endurance.",
        };
  }
  if (
    skill.id === ID.PET_SWAP &&
    flattenProfessionState(context.state.profession).beastmodeActive
  ) {
    return deny(skill, "ranger.pet-merged", "leave Beastmode first.");
  }
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
