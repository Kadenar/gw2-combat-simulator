import { professionCoreState } from "../../../platform/engine/profession.js";
/**
 * Revenant contextual legend-skill follow-ups.
 */
import { REVENANT_SKILL_IDS as ID } from "../data/ids.js";
import { emitRevenantState } from "./shared.js";
import type {
  RevenantCastContext,
  RevenantSkill,
} from "../types.js";

/** Arms or consumes the Call to Anguish / Unyielding Impact flip. */
export function completeRevenantFollowup(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  const state = professionCoreState(context);
  if (skill.id === ID.CALL_TO_ANGUISH) {
    state.availableFlips[ID.UNYIELDING_IMPACT] = true;
    emitRevenantState(context, context.effectiveEnd, "unyielding-impact-ready");
  } else if (skill.id === ID.UNYIELDING_IMPACT) {
    delete state.availableFlips[ID.UNYIELDING_IMPACT];
    emitRevenantState(context, context.effectiveEnd, "unyielding-impact-used");
  }
}
