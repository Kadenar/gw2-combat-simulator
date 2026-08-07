import { specterState } from "./state.js";
import { THIEF_SKILL_IDS as ID } from "../../data/ids.js";
import type { AvailabilityResult } from "../../../../platform/engine/types.js";
import type { ThiefPrecastContext, ThiefSkill } from "../../types.js";

function deny(skill: ThiefSkill, code: string, cause: string): AvailabilityResult {
  return {
    ready: false,
    retryAt: null,
    code,
    reason: `${skill.name} is unavailable — ${cause}`,
  };
}

export function specterCastAvailability(
  context: ThiefPrecastContext,
  skill: ThiefSkill,
): AvailabilityResult {
  const state = specterState.from(context);
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
      || ["Heal", "Utility", "Elite"].includes(skill.type || "")
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
