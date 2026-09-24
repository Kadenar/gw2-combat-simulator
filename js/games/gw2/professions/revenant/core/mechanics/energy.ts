import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { refreshResource, type ResourcePolicy } from '#gw2/platform/combat/resources/resource-policy.js';
import { resourceDepletion } from '#gw2/platform/profession-definition/mechanics.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { clearRevenantLegendFlips } from '#gw2/professions/revenant/core/mechanics/weapon-state.js';
import { emitRevenantStateSnapshot } from '#gw2/professions/revenant/family-state.js';

import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
/**
 * Revenant Energy and endurance lifecycle.
 *
 * The scheduler calls advanceRevenantEnergy whenever its clock advances. This
 * module applies passive regeneration, aggregate upkeep drain, tick-aligned starvation
 * timing, out-of-combat Energy capping and endurance regeneration.
 */
import { REVENANT_CORE_BALANCE_PROFILE_IDS } from '#gw2/professions/revenant/core/profiles.js';
import type {
  RevenantEnergyCostInput,
  RevenantSchedulerContext,
  RevenantSkill
} from '#gw2/professions/revenant/types.js';
import type { RevenantCoreState } from '#gw2/professions/revenant/core/state.js';
import type { EndurancePolicy } from '#gw2/platform/combat/resources/endurance-policy.js';
import { advanceProfessionEndurance } from '#gw2/platform/combat/resources/endurance-policy.js';

function resourceProfile(context: RevenantSchedulerContext) {
  return requireBalanceProfileFromContext(context, REVENANT_CORE_BALANCE_PROFILE_IDS.resources);
}

function activeUpkeepCost(state: RevenantCoreState, at: number): number {
  return state.activeUpkeeps
    .filter((active) => Number(active.startsAt || 0) <= at)
    .reduce((sum, active) => sum + Number(active.upkeepCost || 0), 0);
}

export function revenantEnduranceRegenerationRate(
  context: RevenantSchedulerContext & { readonly start?: number },
  at = context.start ?? context.state.time,
  vigorActive = Boolean(context.config?.boons?.vigor || context.hasBuff?.('vigor', at))
): number {
  const profile = resourceProfile(context);
  const enduringRecovery = hasTrait(context, TRAIT.ENDURING_RECOVERY)
    ? balanceProfileNumber(
        requireBalanceProfileFromContext(context, REVENANT_CORE_BALANCE_PROFILE_IDS.enduringRecovery),
        'enduranceRegenerationMultiplier'
      ) - 1
    : 0;
  // PvE regeneration bonuses add together; Vindicator shares the 25% trait bonus and the ten-per-second cap.
  return Math.min(
    10,
    balanceProfileNumber(profile, 'enduranceRegenerationPerSecond') *
      ((vigorActive ? balanceProfileNumber(profile, 'vigorRegenerationMultiplier') : 1) + enduringRecovery)
  );
}

/** Resources advance centrally; this observer publishes Energy alongside existing endurance recovery. */
export function advanceRevenantEnergy(context: RevenantSchedulerContext, target: number): void {
  advanceProfessionEndurance(context, target);
  emitRevenantStateSnapshot(context, target, 'energy');
}

/** Upkeep starvation is a consequence of the engine's zero-crossing task. */
export const energyDepletion = resourceDepletion({
  id: 'revenant.energy-depleted',
  priority: -300,
  clock: (context: RevenantSchedulerContext) => professionCoreState(context).energy,
  depleted(context: RevenantSchedulerContext, at: number) {
    const state = professionCoreState(context);
    for (const active of state.activeUpkeeps) {
      const skill = context.catalog.skillsById.get(active.skillId);
      const cooldown = Math.max(0, Number(skill?.starvationCooldown || 0));
      if (skill && cooldown > 0) context.cooldownController.startRecharge({ ...skill, cooldown }, at);
      context.tasks.cancelOwner(`revenant.upkeep:${active.skillId}`);
    }

    state.activeUpkeeps = [];
    clearRevenantLegendFlips(context);
    refreshResource(context, 'energy');
    emitRevenantStateSnapshot(context, at, 'upkeep-starved');
  }
});

/** Capacity is distinct from the precombat recovery ceiling, which never discards larger grants. */
export const revenantEnergy: ResourcePolicy<RevenantSchedulerContext> = {
  kind: 'continuous',
  state: (context) => professionCoreState(context).energy,
  maximum: () => 100,
  initial: (context) => Number(context.config.initialEnergy ?? 50),
  recovery: (context) =>
    balanceProfileNumber(resourceProfile(context), 'energyRegenerationPerSecond') -
    activeUpkeepCost(professionCoreState(context), context.state.time),
  recoveryMaximum: (context) => (professionCoreState(context).combatBeganAt == null ? 50 : 100),
  depletion: energyDepletion,
  changed: (context, at) => emitRevenantStateSnapshot(context, at, 'energy')
};

/** Resolves the shared upkeep-aware base cost before an elite specialization applies its own policy. */
export function baseRevenantEnergyCost({ state }: RevenantEnergyCostInput, skill: RevenantSkill): number {
  const active = (state.activeUpkeeps || []).some((upkeep) => upkeep.skillId === skill.id);
  if (active) return 0;
  return Math.max(0, Number(skill.energyCost || 0));
}

/** Binds shared endurance operations to this module's live pool and balance rules. */
export const revenantEndurance: EndurancePolicy<RevenantSchedulerContext> = {
  state: (context) => professionCoreState(context),
  maximum: () => 100,
  regenerationRate: (context, vigor, at) => revenantEnduranceRegenerationRate(context, at, vigor)
};
