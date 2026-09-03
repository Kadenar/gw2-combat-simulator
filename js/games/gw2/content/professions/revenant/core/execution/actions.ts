/**
 * Owns synthetic Core Revenant action behavior for legend swap, dodge, and Ancient Echo.
 * Action declarations live in `skills/actions.ts`; registration lives in `index.ts`.
 */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitRevenantStateSnapshot } from '#gw2/content/professions/revenant/state.js';
import { spendEndurance } from '#gw2/platform/combat/resources/endurance.js';
import { swapRevenantLegend } from '#gw2/content/professions/revenant/core/mechanics/legend-swap.js';
import type { RevenantCastContext, RevenantSkill } from '#gw2/content/professions/revenant/types.js';

/** Pays the profession-wide endurance cost for a dodge. */
export function performRevenantDodge(context: RevenantCastContext, skill: RevenantSkill): void {
  const state = professionCoreState(context);
  Object.assign(state, spendEndurance(state, Number(skill.resourceCost || 0), context.start, state.maximumEndurance));
  emitRevenantStateSnapshot(context, context.start, 'dodge');
}

/** Raw profession-wide callbacks consumed by the central handler registry. */
export const revenantCoreSkillHandlers = Object.freeze({
  'revenant.legend-swap': swapRevenantLegend,
  'revenant.dodge': performRevenantDodge
});

/** Grants Ancient Echo's profession-wide Energy refund. */
export function gainAncientEchoEnergy(context: RevenantCastContext): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  state.energy = Math.min(state.maximumEnergy, state.energy + Number(context.skill.resourceGain || 0));
  emitRevenantStateSnapshot(context, at, 'ancient-echo');
}
