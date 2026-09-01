import { professionCoreState, readProfessionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitRevenantStateSnapshot } from '#gw2/content/professions/revenant/state.js';
import { advanceEndurance, enduranceReadyAt } from '#gw2/platform/combat/resources/endurance.js';
/**
 * Revenant Energy and endurance lifecycle.
 *
 * The scheduler calls advanceRevenantEnergy whenever its clock advances. This
 * module applies passive regeneration, aggregate upkeep drain, exact starvation
 * timing, out-of-combat Energy capping and endurance regeneration.
 */
import { REVENANT_CORE_BALANCE_PROFILE_IDS } from '#gw2/content/professions/revenant/core/skills/index.js';
import type {
  RevenantCoreState,
  RevenantEnergyContext,
  RevenantPrecastContext,
  RevenantSchedulerContext,
  RevenantSkill
} from '#gw2/content/professions/revenant/types.js';

const REVENANT_ENERGY_TICK_INTERVAL = 0.1;

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

function regenerateRevenantEnergy(
  context: RevenantSchedulerContext,
  state: RevenantCoreState,
  from: number,
  target: number,
  rate: number
): number {
  const combatActive = context.schedulerPolicy.isCombatActive?.() ?? state.combatBeganAt != null;
  const maximum = combatActive ? state.maximumEnergy : Math.max(50, state.energy);
  // Out-of-combat regeneration stops at 50 without removing energy that was
  // already above 50.
  return roundedResourceValue(Math.min(maximum, state.energy + (target - from) * rate));
}

export function revenantEnduranceRegenerationRate(
  context: RevenantEnergyContext,
  at = Number(context.start ?? context.time ?? context.state?.time ?? 0)
): number {
  const profile = resourceProfile(context);
  const vigorActive = Boolean(context.config?.boons?.vigor || context.hasBuff?.('vigor', at));
  return Math.min(
    10,
    Number(profile.enduranceRegenerationPerSecond || 0) *
      (vigorActive ? Number(profile.vigorRegenerationMultiplier || 1) : 1)
  );
}

export function revenantEnduranceReadyAt(context: RevenantPrecastContext, cost: number): number | null {
  const current = Number(professionCoreState(context).endurance || 0);
  const rate = revenantEnduranceRegenerationRate(context, context.start);
  return enduranceReadyAt(current, Number(cost || 0), context.start, rate, Number(context.epsilon || 0.0001));
}

/** Returns the first 100 ms Energy tick that can make an in-combat cast affordable. */
export function revenantEnergyReadyAt(context: RevenantPrecastContext, cost: number): number | null {
  const state = professionCoreState(context);
  const regeneration = Number(resourceProfile(context).energyRegenerationPerSecond || 0);
  const upkeep = state.activeUpkeeps
    .filter((active) => Number(active.startsAt || 0) <= context.start + context.epsilon)
    .reduce((sum, active) => sum + Number(active.upkeepCost || 0), 0);
  const gainPerTick = (regeneration - upkeep) * REVENANT_ENERGY_TICK_INTERVAL;
  if (state.combatBeganAt == null || gainPerTick <= 0 || cost > state.maximumEnergy + context.epsilon) return null;

  const missing = cost - state.energy;
  const ticks = Math.max(1, Math.ceil((missing - context.epsilon) / gainPerTick));
  return roundedResourceValue(state.energyUpdatedAt + ticks * REVENANT_ENERGY_TICK_INTERVAL);
}

function advanceRevenantEnergyTick(
  context: RevenantSchedulerContext,
  state: RevenantCoreState,
  from: number,
  target: number,
  regeneration: number
): void {
  // A cast-time upkeep affects the first resource tick on or after its completion, never its activation windup.
  const upkeep = state.activeUpkeeps
    .filter((active) => Number(active.startsAt || 0) <= target + context.epsilon)
    .reduce((sum, active) => sum + Number(active.upkeepCost || 0), 0);
  const rate = regeneration - upkeep;
  const elapsed = target - from;
  const previousEnergy = state.energy;
  if (rate < 0 && state.energy + rate * elapsed < 0) {
    const starvedAt = from + state.energy / -rate;
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
    state.availableFlips = {};
    state.energyUpdatedAt = starvedAt;
    emitRevenantStateSnapshot(context, starvedAt, 'upkeep-starved');
    state.energy = regenerateRevenantEnergy(context, state, starvedAt, target, regeneration);
    state.energyUpdatedAt = target;
    emitRevenantStateSnapshot(context, target, 'energy');
    return;
  }

  state.energy =
    rate > 0
      ? regenerateRevenantEnergy(context, state, from, target, rate)
      : roundedResourceValue(Math.max(0, Math.min(state.maximumEnergy, state.energy + elapsed * rate)));
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
    const enduranceRate = revenantEnduranceRegenerationRate(context, (enduranceFrom + target) / 2);
    Object.assign(state, advanceEndurance(state, target, enduranceRate, state.maximumEndurance));
  }

  // Apply completed 100 ms resource ticks while leaving Energy flat between
  // them, matching the smoother cadence used by other discrete resources.
  let tickFrom = from;
  let tickAt = roundedResourceValue(tickFrom + REVENANT_ENERGY_TICK_INTERVAL);
  while (tickAt <= target) {
    advanceRevenantEnergyTick(context, state, tickFrom, tickAt, regeneration);
    tickFrom = tickAt;
    tickAt = roundedResourceValue(tickFrom + REVENANT_ENERGY_TICK_INTERVAL);
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
