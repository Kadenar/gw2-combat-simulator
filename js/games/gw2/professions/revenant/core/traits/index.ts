/** Owns shared invocation ordering, combat gating, and trait recharge policy. */
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { REVENANT_CORE_BALANCE_PROFILE_IDS } from '#gw2/professions/revenant/core/profiles.js';
import {
  applySongOfTheMists,
  applySpiritBoon,
  emitLegendInvocationProfile,
  emitLegendInvocationSkill
} from '#gw2/professions/revenant/core/traits/invocation.js';
import { applyInvokingTorment } from '#gw2/professions/revenant/core/traits/corruption.js';
import type {
  RevenantCastContext,
  RevenantRechargeContext,
  RevenantSchedulerContext,
  RevenantSkill
} from '#gw2/professions/revenant/types.js';

export { emitLegendInvocationProfile, emitLegendInvocationSkill };

/** Reports whether invocation-only combat effects may run at a timestamp. */
export function revenantCombatActive(context: RevenantSchedulerContext, at = context.state.time): boolean {
  return (
    !context.hasExplicitCombatStart ||
    (context.combatStartTime != null && at + context.epsilon >= Number(context.combatStartTime))
  );
}

/** Applies trait-specific recharge multipliers after shared Alacrity policy. */
export function modifyRevenantRechargeDuration(context: RevenantRechargeContext, duration: number): number {
  const skill = context.skill;
  if (skill && ([ID.SWAP_LEGENDS, ID.SWAP_WEAPONS] as readonly number[]).includes(Number(skill.id))) {
    if (duration === 0) return 0;
    return Math.max(0, Number(skill.cooldown ?? skill.recharge ?? duration));
  }

  return duration;
}

/** Applies selected invocation traits in their stable legend-swap order. */
export function applyLegendInvocationTraits(context: RevenantCastContext, _swapSkill: RevenantSkill): void {
  const at = context.effectiveEnd;
  const legendId = professionCoreState(context).activeLegendId;
  // Every in-combat invocation grants Fury; Invoker's Rage no longer has an internal cooldown.
  if (hasTrait(context, TRAIT.INVOKERS_RAGE) && revenantCombatActive(context, at)) {
    emitLegendInvocationProfile(context, REVENANT_CORE_BALANCE_PROFILE_IDS.invokersRage, at, TRAIT.INVOKERS_RAGE);
  }

  applySpiritBoon(context, legendId, at);
  applySongOfTheMists(context, legendId, at);
  applyInvokingTorment(context, at);
}
