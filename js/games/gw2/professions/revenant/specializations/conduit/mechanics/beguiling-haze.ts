/** Owns Beguiling Haze's cross-cast follow-up charges and main-cast recharge restoration. */
import { balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitRevenantStateSnapshot } from '#gw2/professions/revenant/state.js';
import { CONDUIT_BALANCE_PROFILE_IDS } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import { conduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';
import type { RevenantCastContext, RevenantSkill } from '#gw2/professions/revenant/types.js';

/** Consumes a follow-up charge or records the main cast that will arm them on completion. */
export function beginBeguilingHaze(context: RevenantCastContext): boolean {
  const state = conduitState.from(context);
  const followUp = Number(state.beguilingHazeCharges || 0) > 0;
  if (followUp) state.beguilingHazeCharges -= 1;
  else state.beguilingHazeMainReservations.push(context.reservationId);
  emitRevenantStateSnapshot(context, context.effectiveEnd, 'beguiling-haze');
  return followUp;
}

/** Arms follow-up charges after the main cast and mirrors them into shared ammo state. */
export function completeBeguilingHaze(context: RevenantCastContext, skill: RevenantSkill): void {
  if (skill.handlerId !== 'revenant.beguiling-haze') return;
  const state = conduitState.from(context);
  const index = state.beguilingHazeMainReservations.indexOf(context.reservationId);
  if (index >= 0) {
    state.beguilingHazeMainReservations.splice(index, 1);
    const followUpProfile = balanceProfileFromContext(context, CONDUIT_BALANCE_PROFILE_IDS.beguilingHazeFollowUp);
    state.beguilingHazeCharges = Math.max(0, Number(followUpProfile?.maximumStacks || 0));
    state.beguilingHazeReadyAt = Number(
      context.state.cooldowns.get(skill.id) ?? context.state.ammo.get(skill.id)?.nextRechargeAt ?? context.effectiveEnd
    );
  }

  const ammo = context.state.ammo.get(skill.id);
  if (ammo) {
    if (state.beguilingHazeCharges > 0) {
      ammo.maximum = state.beguilingHazeCharges;
      ammo.charges = state.beguilingHazeCharges;
      ammo.nextRechargeAt = null;
      context.state.cooldowns.delete(skill.id);
    } else {
      ammo.maximum = 1;
      ammo.charges = 0;
      ammo.rechargeDuration = Math.max(0, state.beguilingHazeReadyAt - context.effectiveEnd);
      ammo.nextRechargeAt = state.beguilingHazeReadyAt;
      context.state.cooldowns.set(skill.id, state.beguilingHazeReadyAt);
    }
  }

  emitRevenantStateSnapshot(context, context.effectiveEnd, 'beguiling-haze-follow-up');
}
