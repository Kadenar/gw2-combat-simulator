import { professionCoreState } from '../../../platform/engine/profession/state.js';
/**
 * Revenant Energy and endurance lifecycle.
 *
 * The scheduler calls advanceRevenantEnergy whenever its clock advances. This
 * module applies passive regeneration, aggregate upkeep drain, exact starvation
 * timing, out-of-combat Energy capping and endurance regeneration.
 */
import { emitRevenantState } from './shared.js';
import { REVENANT_CORE_BALANCE_PROFILE_IDS } from './skills.js';
import type {
  RevenantCoreState,
  RevenantEnergyContext,
  RevenantPrecastContext,
  RevenantSchedulerContext,
  RevenantSkill,
  RevenantRuntimeState
} from '../types.js';

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
  return Math.min(maximum, state.energy + (target - from) * rate);
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
  const required = Math.max(0, Number(cost || 0));
  const missing = required - current;
  if (missing <= Number(context.epsilon || 0.0001)) return context.start;
  const rate = revenantEnduranceRegenerationRate(context, context.start);
  return rate > 0 ? context.start + missing / rate : null;
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
    state.endurance = Math.min(state.maximumEndurance, state.endurance + (target - enduranceFrom) * enduranceRate);
    state.enduranceUpdatedAt = target;
  }

  if (target <= from) return;
  const upkeep = state.activeUpkeeps.reduce((sum, active) => sum + Number(active.upkeepCost || 0), 0);
  const rate = regeneration - upkeep;
  const elapsed = target - from;
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
    emitRevenantState(context, starvedAt, 'upkeep-starved');
    state.energy = regenerateRevenantEnergy(context, state, starvedAt, target, regeneration);
    state.energyUpdatedAt = target;
    emitRevenantState(context, target, 'energy');
    return;
  }

  state.energy =
    rate > 0
      ? regenerateRevenantEnergy(context, state, from, target, rate)
      : Math.max(0, Math.min(state.maximumEnergy, state.energy + elapsed * rate));
  state.energyUpdatedAt = target;
  emitRevenantState(context, target, 'energy');
}

/** Minimal Core state used to make active upkeep toggles free. */
interface RevenantEnergyCostState {
  readonly activeUpkeeps?: RevenantCoreState['activeUpkeeps'];
}

function energyCostCoreState(context: RevenantEnergyContext): RevenantEnergyCostState {
  const schedulerState = context.state && 'profession' in context.state ? context.state : undefined;
  const candidate = schedulerState?.profession ?? context.professionState ?? context.state ?? {};
  if (candidate && typeof candidate === 'object' && 'core' in candidate && 'specialization' in candidate) {
    return (candidate as RevenantRuntimeState).core;
  }

  return candidate as RevenantEnergyCostState;
}

/** Resolves the shared upkeep-aware base cost before an elite specialization applies its own policy. */
export function baseRevenantEnergyCost(context: RevenantEnergyContext, skill: RevenantSkill): number {
  const state = energyCostCoreState(context);
  const active = (state.activeUpkeeps || []).some((upkeep) => upkeep.skillId === skill.id);
  if (active) return 0;
  return Math.max(0, Number(skill.energyCost || 0));
}
