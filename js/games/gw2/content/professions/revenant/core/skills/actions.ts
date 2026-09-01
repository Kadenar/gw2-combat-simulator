import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitRevenantStateSnapshot } from '#gw2/content/professions/revenant/state.js';
import { spendEndurance } from '#gw2/platform/combat/resources/endurance.js';
/**
 * Core Revenant action-handler map.
 *
 * Groups callbacks that are not owned by one legend or elite-specialization
 * feature. handlers.js applies the actual replacement strategies so these
 * modules remain focused on their state transitions.
 */
import { REVENANT_SKILL_IDS as ID } from '#gw2/content/professions/revenant/data/ids.js';
import { swapRevenantLegend } from '#gw2/content/professions/revenant/core/mechanics/legend-swap.js';
import type { RevenantCastContext, RevenantSkill } from '#gw2/content/professions/revenant/types.js';

/** Pays the profession-wide endurance cost for a dodge. */
export function performRevenantDodge(context: RevenantCastContext, skill: RevenantSkill): void {
  const state = professionCoreState(context);
  Object.assign(state, spendEndurance(state, Number(skill.resourceCost || 0), context.start, state.maximumEndurance));
  emitRevenantStateSnapshot(context, context.start, 'dodge');
}

/** Arms or consumes the Call to Anguish / Unyielding Impact flip. */
export function completeRevenantFollowup(context: RevenantCastContext, skill: RevenantSkill): void {
  const state = professionCoreState(context);
  if (skill.id === ID.CALL_TO_ANGUISH) {
    state.availableFlips[ID.UNYIELDING_IMPACT] = true;
    emitRevenantStateSnapshot(context, context.effectiveEnd, 'unyielding-impact-ready');
  } else if (skill.id === ID.UNYIELDING_IMPACT) {
    delete state.availableFlips[ID.UNYIELDING_IMPACT];
    emitRevenantStateSnapshot(context, context.effectiveEnd, 'unyielding-impact-used');
  }
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
