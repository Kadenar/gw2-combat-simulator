import { emitStateSnapshot } from '#gw2/platform/engine/events/state-snapshots.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { snapshotRevenantState } from '#gw2/content/professions/revenant/state.js';
/**
 * Revenant legend-swap transition.
 *
 * Switches the active fixed bar, resets Energy/upkeep/flip state, fires the
 * shared swap-sigil event, and applies Core invocation traits. Active elite
 * modules react to the swap event with their own state and invocation effects.
 */
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/content/professions/revenant/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { applyLegendInvocationTraits } from '#gw2/content/professions/revenant/core/traits/legend-invocation.js';
import { REVENANT_CORE_BALANCE_PROFILE_IDS } from '#gw2/content/professions/revenant/core/skills/index.js';
import type {
  RevenantCastContext,
  RevenantSchedulerContext,
  RevenantSkill
} from '#gw2/content/professions/revenant/types.js';

/** Reports whether invocation-only combat effects may run at a timestamp. */
export function revenantCombatActive(context: RevenantSchedulerContext, at = context.state.time): boolean {
  return (
    !context.hasExplicitCombatStart ||
    (context.combatStartTime != null && at + context.epsilon >= Number(context.combatStartTime))
  );
}

/** Executes the complete legend-swap transition at cast completion. */
export function swapRevenantLegend(context: RevenantCastContext, skill: RevenantSkill): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const previousEnergy = state.energy;
  const other = state.selectedLegendIds.find((id) => id !== state.activeLegendId);
  state.activeLegendId = other || state.activeLegendId;
  state.activeLoadoutId = state.activeLegendId;
  state.legendSwapReadyAt = at + Math.max(0, Number(context.rechargeDuration ?? 10));
  const chargedMists = context.catalog.balanceProfilesById.get(REVENANT_CORE_BALANCE_PROFILE_IDS.chargedMists);
  if (!chargedMists) throw new Error('Missing Charged Mists balance profile.');
  state.energy =
    Math.floor(previousEnergy) <= Number(chargedMists.threshold || 0) && hasTrait(context.config, TRAIT.CHARGED_MISTS)
      ? Number(chargedMists.resourceGain || 0)
      : Number(skill.resourceGain || 0);
  state.energyUpdatedAt = at;
  state.activeUpkeeps = [];
  state.availableFlips = {};
  context.emit({
    type: 'sigil_swap',
    at,
    source: 'revenant',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    weaponSet: context.state.activeWeaponSet
  });
  if (revenantCombatActive(context, at)) {
    applyLegendInvocationTraits(context, skill);
  }

  emitStateSnapshot(context, 'revenant', at, 'legend-swap', snapshotRevenantState(context.state.profession));
}
