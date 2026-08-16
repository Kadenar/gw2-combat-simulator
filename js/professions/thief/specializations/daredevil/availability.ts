import { daredevilState } from "./state.js";
import { THIEF_SKILL_IDS as ID } from "../../data/ids.js";
import type { AvailabilityResult } from "../../../../platform/engine/types.js";
import type { ThiefPrecastContext, ThiefSkill } from "../../types.js";

export function daredevilCastAvailability(
  context: ThiefPrecastContext,
  skill: ThiefSkill,
): AvailabilityResult {
  if (skill.id !== ID.PALM_STRIKE) return { ready: true };
  // Palm Strike is only castable after Fist Flurry connects; palmStrikeUntil tracks the open window
  if (daredevilState.from(context).palmStrikeUntil > context.start) {
    return { ready: true };
  }
  return {
    ready: false,
    // retryAt: null because there is no timer to poll — the window only opens on Fist Flurry hit
    retryAt: null,
    code: "thief.palm-strike",
    reason: "Palm Strike is unavailable — Fist Flurry must connect first.",
  };
}
