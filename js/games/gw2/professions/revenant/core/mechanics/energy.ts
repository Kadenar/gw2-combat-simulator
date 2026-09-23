import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { resourceValueAt, resourceDepletionAt } from '#gw2/platform/combat/resources/clock.js';
import { EPSILON } from '#kernel/core/clock.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { clearRevenantLegendFlips } from '#gw2/professions/revenant/core/mechanics/weapon-state.js';
import { emitRevenantStateSnapshot } from '#gw2/professions/revenant/family-state.js';
import {
  advanceEnduranceIntervals,
  enduranceIntervalsReadyAt,
  vigorEnduranceIntervals
} from '#gw2/platform/combat/resources/endurance.js';
import { quantizeGw2ActionDurationUp } from '#gw2/platform/skills/timing.js';
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
  RevenantPrecastContext,
  RevenantSchedulerContext,
  RevenantSkill
} from '#gw2/professions/revenant/types.js';
import type { RevenantCoreState } from '#gw2/professions/revenant/core/state.js';

function roundedResourceValue(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}

function resourceProfile(context: RevenantSchedulerContext) {
  return requireBalanceProfileFromContext(context, REVENANT_CORE_BALANCE_PROFILE_IDS.resources);
}

function syncRevenantCombatState(context: RevenantSchedulerContext, state: RevenantCoreState): void {
  const sharedAt = context.schedulerPolicy.combatBeganAt?.();
  if (sharedAt == null) return;
  const at = Number(sharedAt);
  if (Number.isFinite(at)) state.combatBeganAt = at;
}

function accruedEnergy(accrual: NonNullable<RevenantCoreState['energyAccrual']>, at: number): number {
  return roundedResourceValue(resourceValueAt(accrual, at));
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

/** Share actual Vigor windows between accrual and resource-funded dodge scheduling. */
function enduranceIntervals(context: RevenantSchedulerContext, start: number, end: number) {
  return vigorEnduranceIntervals(context, start, end, (vigor, at) =>
    revenantEnduranceRegenerationRate(context, at, vigor)
  );
}

export function revenantEnduranceReadyAt(context: RevenantPrecastContext, cost: number): number | null {
  const state = professionCoreState(context);
  // Use capped endurance traversal without changing Revenant's separate energy accrual policy.
  return enduranceIntervalsReadyAt(
    { endurance: Number(state.endurance || 0), enduranceUpdatedAt: context.start },
    cost,
    enduranceIntervals(context, context.start, Infinity),
    state.maximumEndurance
  );
}

/** Keeps regeneration-funded casts on the absolute 40 ms grid without rounding the stored Energy. */
export function revenantEnergyReadyAt(context: RevenantPrecastContext, cost: number): number | null {
  const state = professionCoreState(context);
  const regeneration = balanceProfileNumber(resourceProfile(context), 'energyRegenerationPerSecond');
  const rate = regeneration - activeUpkeepCost(state, context.start);
  const accrual = state.energyAccrual;
  const enough = state.energy + EPSILON >= cost;
  // Immediate refunds and an already sufficient pool do not introduce an Energy wait.
  if (enough && (!accrual || accrual.rate <= 0 || accrual.value + EPSILON >= cost)) return context.start;
  if (rate <= 0 || cost > state.maximumEnergy + EPSILON || (!enough && state.combatBeganAt == null)) return null;
  const threshold = accrual
    ? accrual.updatedAt + (cost - accrual.value) / rate
    : context.start + (cost - state.energy) / rate;
  return quantizeGw2ActionDurationUp(threshold * 1000) / 1000;
}

function advanceRevenantEnergyInterval(
  context: RevenantSchedulerContext,
  state: RevenantCoreState,
  from: number,
  target: number,
  regeneration: number
): void {
  const rate = regeneration - activeUpkeepCost(state, from);
  const combatActive = state.combatBeganAt != null && from >= state.combatBeganAt;
  const maximum = combatActive ? state.maximumEnergy : Math.max(50, state.energy);
  const previousEnergy = state.energy;
  let accrual = state.energyAccrual;
  // Spending, refunds, and rate changes start a new segment; ordinary reads retain the original threshold times.
  if (
    !accrual ||
    accruedEnergy(accrual, from) !== state.energy ||
    accrual.rate !== rate ||
    accrual.maximum !== maximum
  ) {
    accrual = state.energyAccrual = { updatedAt: from, value: state.energy, rate, maximum };
  }

  const starvedAt = quantizeGw2ActionDurationUp(resourceDepletionAt(accrual) * 1000) / 1000;
  if (starvedAt <= target) {
    state.energy = 0;
    for (const active of state.activeUpkeeps) {
      const skill = context.catalog.skillsById.get(active.skillId);
      const cooldown = Math.max(0, Number(skill?.starvationCooldown || 0));
      if (cooldown > 0) {
        context.state.cooldowns.set(active.skillId, starvedAt + cooldown);
      }

      context.tasks.cancelOwner(`revenant.upkeep:${active.skillId}`);
    }

    state.activeUpkeeps = [];
    clearRevenantLegendFlips(context);
    state.energyUpdatedAt = starvedAt;
    emitRevenantStateSnapshot(context, starvedAt, 'upkeep-starved');
    state.energyAccrual = { updatedAt: starvedAt, value: 0, rate: regeneration, maximum };
    state.energy = accruedEnergy(state.energyAccrual, target);
    state.energyUpdatedAt = target;
    emitRevenantStateSnapshot(context, target, 'energy');
    return;
  }

  state.energy = accruedEnergy(accrual, target);
  state.energyUpdatedAt = target;
  if (state.energy !== previousEnergy) {
    emitRevenantStateSnapshot(context, target, 'energy');
  }
}

/**
 * Advances Energy, endurance, upkeep drain, and starvation.
 */
export function advanceRevenantEnergy(context: RevenantSchedulerContext, target: number): void {
  const regeneration = balanceProfileNumber(resourceProfile(context), 'energyRegenerationPerSecond');
  const state = professionCoreState(context);
  syncRevenantCombatState(context, state);
  const from = Number(state.energyUpdatedAt || 0);
  const enduranceFrom = Number(state.enduranceUpdatedAt || 0);
  if (target > enduranceFrom) {
    Object.assign(
      state,
      advanceEnduranceIntervals(state, enduranceIntervals(context, enduranceFrom, target), state.maximumEndurance)
    );
  }

  // Integrate once per rate/cap change, including upkeeps reserved for a future cast completion.
  const boundaries = [
    ...new Set([...state.activeUpkeeps.map((active) => Number(active.startsAt || 0)), state.combatBeganAt ?? from])
  ]
    .filter((at) => at > from && at < target)
    .sort((left, right) => left - right);
  let intervalStart = from;
  for (const at of [...boundaries, target]) {
    if (at < intervalStart) continue;
    advanceRevenantEnergyInterval(context, state, intervalStart, at, regeneration);
    intervalStart = at;
  }
}

/** Resolves the shared upkeep-aware base cost before an elite specialization applies its own policy. */
export function baseRevenantEnergyCost({ state }: RevenantEnergyCostInput, skill: RevenantSkill): number {
  const active = (state.activeUpkeeps || []).some((upkeep) => upkeep.skillId === skill.id);
  if (active) return 0;
  return Math.max(0, Number(skill.energyCost || 0));
}
