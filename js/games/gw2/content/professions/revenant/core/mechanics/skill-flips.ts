/** Owns cross-cast Revenant skill flips that remain armed until a later activation consumes them. */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitRevenantStateSnapshot } from '#gw2/content/professions/revenant/state.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/content/professions/revenant/data/ids.js';
import type { RevenantCastContext, RevenantSkill } from '#gw2/content/professions/revenant/types.js';

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
