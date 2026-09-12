/**
 * Owns synthetic Core Revenant action behavior for dodge and Ancient Echo.
 * Action declarations live in `skills/actions.ts`; registration lives in `index.ts`.
 */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitRevenantStateSnapshot } from '#gw2/professions/revenant/state.js';
import { spendEndurance } from '#gw2/platform/combat/resources/endurance.js';
import type { RevenantCastContext, RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Pays the profession-wide endurance cost for a dodge. */
export function performRevenantDodge(context: RevenantCastContext, skill: RevenantSkill, reason = 'dodge'): void {
  const state = professionCoreState(context);
  Object.assign(state, spendEndurance(state, Number(skill.resourceCost || 0), context.start, state.maximumEndurance));
  emitRevenantStateSnapshot(context, context.start, reason);
}

/** Grants Ancient Echo's profession-wide Energy refund. */
export function gainAncientEchoEnergy(context: RevenantCastContext): void {
  // Refund Energy only when Ancient Echo successfully completes.
  if (context.action.cancelled) return;
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  state.energy = Math.min(state.maximumEnergy, state.energy + Number(context.skill.resourceGain || 0));
  emitRevenantStateSnapshot(context, at, 'ancient-echo');
}
