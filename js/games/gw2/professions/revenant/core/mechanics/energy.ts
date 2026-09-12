import { professionCoreState, readProfessionCoreState } from '#gw2/platform/engine/profession/state.js';
import { clearRevenantLegendFlips } from '#gw2/professions/revenant/core/mechanics/weapon-state.js';
import { emitRevenantStateSnapshot } from '#gw2/professions/revenant/state.js';
import { advanceEnduranceIntervals, enduranceIntervalsReadyAt } from '#gw2/platform/combat/resources/endurance.js';
import { selfBoonIntervals } from '#gw2/platform/combat/state/boon-extensions.js';
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
  RevenantCoreState,
  RevenantEnergyContext,
  RevenantPrecastContext,
  RevenantSchedulerContext,
  RevenantSkill
} from '#gw2/professions/revenant/types.js';

function roundedResourceValue(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}

function resourceProfile(context: RevenantEnergyContext) {
  const profile = context.catalog?.balanceProfilesById.get(REVENANT_CORE_BALANCE_PROFILE_IDS.resources);
  if (!profile) throw new Error('Missing Revenant resource balance profile.');
  return profile;
}

function syncRevenantCombatState(context: RevenantSchedulerContext, state: RevenantCoreState): void {
  const sharedAt = context.schedulerPolicy.combatBeganAt?.();
  if (sharedAt == null) return;
  const at = Number(sharedAt);
  if (Number.isFinite(at)) state.combatBeganAt = at;
}

function accruedEnergy(accrual: NonNullable<RevenantCoreState['energyAccrual']>, at: number): number {
  return roundedResourceValue(
    Math.max(0, Math.min(accrual.maximum, accrual.energy + (at - accrual.at) * accrual.rate))
  );
}

function activeUpkeepCost(state: RevenantCoreState, at: number): number {
  return state.activeUpkeeps
    .filter((active) => Number(active.startsAt || 0) <= at)
    .reduce((sum, active) => sum + Number(active.upkeepCost || 0), 0);
}

export function revenantEnduranceRegenerationRate(
  context: RevenantEnergyContext,
  at = Number(context.start ?? context.time ?? context.state?.time ?? 0),
  vigorActive = Boolean(context.config?.boons?.vigor || context.hasBuff?.('vigor', at))
): number {
  const profile = resourceProfile(context);
  const enduringRecovery = hasTrait(context, TRAIT.ENDURING_RECOVERY)
    ? Number(
        context.catalog?.balanceProfilesById.get(REVENANT_CORE_BALANCE_PROFILE_IDS.enduringRecovery)
          ?.enduranceRegenerationMultiplier ?? 1
      ) - 1
    : 0;
  // PvE regeneration bonuses add together; Vindicator shares the 25% trait bonus and the ten-per-second cap.
  return Math.min(
    10,
    Number(profile.enduranceRegenerationPerSecond || 0) *
      ((vigorActive ? Number(profile.vigorRegenerationMultiplier ?? 1) : 1) + enduringRecovery)
  );
}

/** Share actual Vigor windows between accrual and resource-funded dodge scheduling. */
function* enduranceIntervals(context: RevenantSchedulerContext, start: number, end: number) {
  for (const interval of selfBoonIntervals(context.events, 'vigor', start, end, Boolean(context.config.boons?.vigor))) {
    yield {
      ...interval,
      rate: revenantEnduranceRegenerationRate(
        context,
        interval.start,
        Boolean(context.config.boons?.vigor || interval.active)
      )
    };
  }
}

export function revenantEnduranceReadyAt(context: RevenantPrecastContext, cost: number): number | null {
  const state = professionCoreState(context);
  // Use capped endurance traversal without changing Revenant's separate energy accrual policy.
  return enduranceIntervalsReadyAt(
    { endurance: Number(state.endurance || 0), enduranceUpdatedAt: context.start },
    cost,
    enduranceIntervals(context, context.start, Infinity),
    state.maximumEndurance,
    context.epsilon
  );
}

/** Keeps regeneration-funded casts on the absolute 40 ms grid without rounding the stored Energy. */
export function revenantEnergyReadyAt(context: RevenantPrecastContext, cost: number): number | null {
  const state = professionCoreState(context);
  const regeneration = Number(resourceProfile(context).energyRegenerationPerSecond || 0);
  const rate = regeneration - activeUpkeepCost(state, context.start);
  const accrual = state.energyAccrual;
  const enough = state.energy + context.epsilon >= cost;
  // Immediate refunds and an already sufficient pool do not introduce an Energy wait.
  if (enough && (!accrual || accrual.rate <= 0 || accrual.energy + context.epsilon >= cost)) return context.start;
  if (rate <= 0 || cost > state.maximumEnergy + context.epsilon || (!enough && state.combatBeganAt == null))
    return null;
  const threshold = accrual
    ? accrual.at + (cost - accrual.energy) / rate
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
    accrual = state.energyAccrual = { at: from, energy: state.energy, rate, maximum };
  }

  const starvedAt =
    rate < 0 ? quantizeGw2ActionDurationUp((accrual.at + accrual.energy / -rate) * 1000) / 1000 : Infinity;
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
    state.energyAccrual = { at: starvedAt, energy: 0, rate: regeneration, maximum };
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
  const resource = resourceProfile(context);
  const regeneration = Number(resource.energyRegenerationPerSecond || 0);
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

/** Minimal Core state used to make active upkeep toggles free. */
interface RevenantEnergyCostState {
  readonly activeUpkeeps?: RevenantCoreState['activeUpkeeps'];
}

// Flatten the core resource fields needed by specialization-aware energy-cost
// rules without exposing mutable scheduler state.
function energyCostCoreState(context: RevenantEnergyContext): RevenantEnergyCostState {
  const schedulerState = context.state && 'profession' in context.state ? context.state : undefined;
  const candidate = schedulerState?.profession ?? context.professionState ?? context.state ?? {};
  return readProfessionCoreState<RevenantEnergyCostState>(candidate);
}

/** Resolves the shared upkeep-aware base cost before an elite specialization applies its own policy. */
export function baseRevenantEnergyCost(context: RevenantEnergyContext, skill: RevenantSkill): number {
  const state = energyCostCoreState(context);
  const active = (state.activeUpkeeps || []).some((upkeep) => upkeep.skillId === skill.id);
  if (active) return 0;
  return Math.max(0, Number(skill.energyCost || 0));
}
