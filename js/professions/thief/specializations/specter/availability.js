import { THIEF_SKILL_IDS as ID } from "../../data/ids.js";

function deny(skill, code, cause) {
  return {
    ready: false,
    retryAt: null,
    code,
    reason: `${skill.name} is unavailable — ${cause}`,
  };
}

export function specterCastAvailability(context, skill) {
  const state = context.state.profession;
  if (skill.id === ID.ENTER_SHADOW_SHROUD) {
    if (state.shadowShroudActive) {
      return deny(skill, "thief.in-shroud", "Shadow Shroud is already active.");
    }
    if (state.shadowForce <= 0) {
      return deny(skill, "thief.shadow-force", "requires shadow force.");
    }
  }
  if (skill.id === ID.EXIT_SHADOW_SHROUD && !state.shadowShroudActive) {
    return deny(skill, "thief.not-in-shroud", "Shadow Shroud is not active.");
  }
  if (skill.shadowShroudSkill && !state.shadowShroudActive) {
    return deny(skill, "thief.not-in-shroud", "enter Shadow Shroud first.");
  }
  if (
    state.shadowShroudActive
    && !skill.shadowShroudSkill
    && (
      skill.type === "Weapon"
      || ["Heal", "Utility", "Elite"].includes(skill.type)
    )
  ) {
    return deny(
      skill,
      "thief.in-shroud",
      "the Shadow Shroud bar replaces weapons and slot skills.",
    );
  }
  return { ready: true };
}
