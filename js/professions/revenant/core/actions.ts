/**
 * Core Revenant action-handler map.
 *
 * Groups callbacks that are not owned by one legend or elite-specialization
 * feature. handlers.js applies the actual replacement strategies so these
 * modules remain focused on their state transitions.
 */
import { performRevenantDodge } from "./dodge.js";
import { swapRevenantLegend } from "./legend.js";
import { swapRevenantWeapons } from "./shared.js";
import { emitRevenantState } from "./shared.js";
import type { RevenantCastContext } from "../types.js";
import { REVENANT_CORE_MECHANICS as MECHANICS } from "./mechanics.js";

/** Raw profession-wide callbacks consumed by the central handler registry. */
export const revenantCoreSkillHandlers = Object.freeze({
  "revenant.weapon-swap": swapRevenantWeapons,
  "revenant.legend-swap": swapRevenantLegend,
  "revenant.dodge": performRevenantDodge,
});

/** Grants Ancient Echo's profession-wide Energy refund. */
export function gainAncientEchoEnergy(
  context: RevenantCastContext,
): void {
  const state = context.state.profession;
  const at = context.effectiveEnd;
  state.energy = Math.min(
    state.maximumEnergy,
    state.energy + MECHANICS.energy.ancientEchoEnergy,
  );
  emitRevenantState(context, at, "ancient-echo");
}
