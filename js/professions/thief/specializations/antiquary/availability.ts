import { antiquaryState } from "./state.js";
import { THIEF_SKILL_IDS as ID } from "../../data/ids.js";
import type { AvailabilityResult } from "../../../../platform/engine/types.js";
import type { ThiefPrecastContext, ThiefSkill } from "../../types.js";

function deny(
  skill: ThiefSkill,
  code: string,
  cause: string,
  retryAt: number | null = null,
): AvailabilityResult {
  return {
    ready: false,
    retryAt,
    code,
    reason: `${skill.name} is unavailable — ${cause}`,
  };
}

export function antiquaryCastAvailability(
  context: ThiefPrecastContext,
  skill: ThiefSkill,
): AvailabilityResult {
  const state = antiquaryState.from(context);
  if (skill.artifactKind) {
    if (
      state.artifactUsesRemaining <= 0
      || !state.artifactSlots.some(slot => slot.skillId === skill.id)
    ) {
      const retryAt =
        context.config.deterministicChoices?.artifactDrawSequence === "choose"
        && Number(state.nextSkrittScufflePilferAt || 0) > context.start
          ? Number(state.nextSkrittScufflePilferAt)
          : null;
      return deny(
        skill,
        "thief.artifact",
        "this artifact is not in an available artifact slot.",
        retryAt,
      );
    }
  }
  if (skill.backfire) {
    return deny(
      skill,
      "thief.backfire-variant",
      "backfire variants are resolved by their Double Edge skill.",
    );
  }
  if (
    skill.id === ID.RESHUFFLE
    && (
      state.artifactUsesRemaining <= 0
      || state.artifactSlots.length === 0
    )
  ) {
    return deny(skill, "thief.artifact", "pilfer artifacts first.");
  }
  return { ready: true };
}
