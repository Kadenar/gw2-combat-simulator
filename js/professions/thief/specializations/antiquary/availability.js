import { THIEF_SKILL_IDS as ID } from "../../data/ids.js";

function deny(skill, code, cause, retryAt = null) {
  return {
    ready: false,
    retryAt,
    code,
    reason: `${skill.name} is unavailable — ${cause}`,
  };
}

export function antiquaryCastAvailability(context, skill) {
  const state = context.state.profession;
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
