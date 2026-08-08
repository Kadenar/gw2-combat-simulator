import { professionCoreState } from "../../../platform/engine/profession.js";
/**
 * Revenant legend-swap transition.
 *
 * Switches the active fixed bar, resets Energy/upkeep/flip state, fires the
 * shared swap-sigil event, and applies Core invocation traits. Active elite
 * modules react to the swap event with their own state and invocation effects.
 */
import { REVENANT_TRAIT_IDS as TRAIT } from "../data/ids.js";
import { hasRevenantTrait } from "./state.js";
import { applyLegendInvocationTraits } from "./legend-traits.js";
import { REVENANT_CORE_MECHANICS as MECHANICS } from "./mechanics.js";
import { emitRevenantState } from "./shared.js";
import type {
  RevenantCastContext,
  RevenantSchedulerContext,
  RevenantSkill,
} from "../types.js";

/** Reports whether invocation-only combat effects may run at a timestamp. */
export function revenantCombatActive(
  context: RevenantSchedulerContext,
  at = context.state.time,
): boolean {
  return (
    !context.hasExplicitCombatStart ||
    (context.combatStartTime != null &&
      at + context.epsilon >= Number(context.combatStartTime))
  );
}

/** Executes the complete legend-swap transition at cast completion. */
export function swapRevenantLegend(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const previousEnergy = state.energy;
  const other = state.selectedLegendIds.find(
    (id) => id !== state.activeLegendId,
  );
  state.activeLegendId = other || state.activeLegendId;
  state.activeLoadoutId = state.activeLegendId;
  state.legendSwapReadyAt =
    at + Math.max(0, Number(context.rechargeDuration ?? 10));
  state.energy =
    Math.floor(previousEnergy) <= MECHANICS.energy.chargedMistsThreshold &&
    hasRevenantTrait(context.config, TRAIT.CHARGED_MISTS)
      ? MECHANICS.energy.chargedMistsSwap
      : MECHANICS.energy.legendSwap;
  state.energyUpdatedAt = at;
  state.activeUpkeeps = [];
  state.availableFlips = {};
  context.emit({
    type: "sigil_swap",
    at,
    source: "revenant",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    weaponSet: context.state.activeWeaponSet,
  });
  if (revenantCombatActive(context, at)) {
    applyLegendInvocationTraits(context, skill);
  }
  emitRevenantState(context, at, "legend-swap");
}
