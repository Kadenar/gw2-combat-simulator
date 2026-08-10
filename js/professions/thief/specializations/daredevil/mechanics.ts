import { THIEF_SKILL_IDS as ID } from "../../data/ids.js";
import { emitThiefState } from "../../core/shared.js";
import type { ThiefCastContext, ThiefSkill } from "../../types.js";
import { daredevilState } from "./state.js";

export function updatePalmStrikeWindow(
  context: ThiefCastContext,
  skill: ThiefSkill,
): void {
  const state = daredevilState.from(context);
  if (skill.id === ID.FIST_FLURRY) {
    state.palmStrikeUntil = context.effectiveEnd + 5;
    emitThiefState(context, context.effectiveEnd, "palm-strike-ready");
  } else if (skill.id === ID.PALM_STRIKE) {
    state.palmStrikeUntil = 0;
    emitThiefState(context, context.effectiveEnd, "palm-strike-used");
  }
}
