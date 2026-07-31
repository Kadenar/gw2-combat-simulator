import { professionCoreState } from "../../../platform/engine/profession.js";
import { emitRevenantState } from "./shared.js";
import { REVENANT_CORE_MECHANICS as MECHANICS } from "./mechanics.js";
import type {
  RevenantCastContext,
  RevenantSkill,
} from "../types.js";

/** Pays the profession-wide endurance cost for a dodge. */
export function performRevenantDodge(
  context: RevenantCastContext,
  _skill: RevenantSkill,
): void {
  const state = professionCoreState(context);
  state.endurance = Math.max(
    0,
    state.endurance - MECHANICS.endurance.dodgeCost,
  );
  emitRevenantState(context, context.start, "dodge");
}
