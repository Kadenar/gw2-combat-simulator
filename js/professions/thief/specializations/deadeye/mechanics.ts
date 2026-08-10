import { THIEF_SKILL_IDS as ID } from "../../data/ids.js";
import { emitThiefState } from "../../core/shared.js";
import type { ThiefCastContext, ThiefSkill } from "../../types.js";
import { deadeyeState } from "./state.js";
import { applyMaleficentSeven } from "./traits.js";

export const DEADEYE_STOLEN_ID_BY_CHOICE: Readonly<Record<string, number>> =
  Object.freeze({
    "steal-time": ID.STEAL_TIME,
    "steal-warmth": ID.STEAL_WARMTH,
    "steal-resistance": ID.STEAL_RESISTANCE,
    "steal-precision": ID.STEAL_PRECISION,
    "steal-health": ID.STEAL_HEALTH,
    "steal-strength": ID.STEAL_STRENGTH,
    "steal-durability": ID.STEAL_DURABILITY,
    "steal-defenses": ID.STEAL_DEFENSES,
    "steal-mobility": ID.STEAL_MOBILITY,
  });

export function updateDeadeyeMalice(
  context: ThiefCastContext,
  skill: ThiefSkill,
): void {
  const state = deadeyeState.from(context);
  const at = context.effectiveEnd;
  if (
    state.markedTargetId &&
    skill.type === "Weapon" &&
    Number(skill.initiativeCost || 0) > 0 &&
    !skill.stealthAttack
  ) {
    state.malice = Math.min(state.maximumMalice, state.malice + 1);
    applyMaleficentSeven(context, at);
    emitThiefState(context, at, "malice");
  }
  if (
    skill.malicious &&
    state.markedTargetId &&
    context.effectiveEnd >= context.fullEnd - context.epsilon
  ) {
    state.malice = 0;
    state.maleficentSevenTriggered = false;
    emitThiefState(context, at, "malice-spent");
  }
}
