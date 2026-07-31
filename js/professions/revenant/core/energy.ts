import {
  flattenProfessionState,
  professionCoreState,
} from "../../../platform/engine/profession.js";
/**
 * Revenant Energy and endurance lifecycle.
 *
 * The scheduler calls advanceRevenantEnergy whenever its clock advances and
 * spendRevenantEnergy at cast start. This module applies passive regeneration,
 * aggregate upkeep drain, exact starvation timing, out-of-combat Energy
 * capping and endurance regeneration.
 */
import { REVENANT_SKILL_IDS as ID } from "../data/ids.js";
import { hasRevenantTrait } from "./state.js";
import { emitRevenantState } from "./shared.js";
import { REVENANT_CORE_MECHANICS } from "./mechanics.js";
import type {
  RevenantCoreState,
  RevenantEnergyContext,
  RevenantPrecastContext,
  RevenantSchedulerContext,
  RevenantSkill,
  RevenantState,
} from "../types.js";

const MECHANICS = REVENANT_CORE_MECHANICS;

function syncRevenantCombatState(
  context: RevenantSchedulerContext,
  state: RevenantCoreState,
): void {
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
  rate: number,
): number {
  const combatActive =
    context.schedulerPolicy.isCombatActive?.() ?? state.combatBeganAt != null;
  const maximum = combatActive
    ? state.maximumEnergy
    : Math.max(50, state.energy);
  // Out-of-combat regeneration stops at 50 without removing energy that was
  // already above 50.
  return Math.min(maximum, state.energy + (target - from) * rate);
}

export function revenantEnduranceRegenerationRate(
  context: RevenantEnergyContext,
  at = Number(context.start ?? context.time ?? context.state?.time ?? 0),
): number {
  const vigorActive = Boolean(
    context.config?.boons?.vigor ||
    context.hasBuff?.("vigor", at),
  );
  return Math.min(
    10,
    MECHANICS.endurance.regenerationPerSecond *
      (vigorActive ? MECHANICS.endurance.vigorRegenerationMultiplier : 1),
  );
}

export function revenantEnduranceReadyAt(
  context: RevenantPrecastContext,
  cost: number,
): number | null {
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
export function advanceRevenantEnergy(
  context: RevenantSchedulerContext,
  target: number,
): void {
  const state = professionCoreState(context);
  syncRevenantCombatState(context, state);
  const from = Number(state.energyUpdatedAt || 0);
  const enduranceFrom = Number(state.enduranceUpdatedAt || 0);
  if (target > enduranceFrom) {
    const enduranceRate = revenantEnduranceRegenerationRate(
      context,
      (enduranceFrom + target) / 2,
    );
    state.endurance = Math.min(
      state.maximumEndurance,
      state.endurance + (target - enduranceFrom) * enduranceRate,
    );
    state.enduranceUpdatedAt = target;
  }
  if (target <= from) return;
  const upkeep = state.activeUpkeeps.reduce(
    (sum, active) => sum + Number(active.upkeepCost || 0),
    0,
  );
  const rate = MECHANICS.energy.regenerationPerSecond - upkeep;
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
    emitRevenantState(context, starvedAt, "upkeep-starved");
    state.energy = regenerateRevenantEnergy(
      context,
      state,
      starvedAt,
      target,
      MECHANICS.energy.regenerationPerSecond,
    );
    state.energyUpdatedAt = target;
    emitRevenantState(context, target, "energy");
    return;
  }
  state.energy =
    rate > 0
      ? regenerateRevenantEnergy(context, state, from, target, rate)
      : Math.max(
          0,
          Math.min(state.maximumEnergy, state.energy + elapsed * rate),
        );
  state.energyUpdatedAt = target;
  emitRevenantState(context, target, "energy");
}

/** Resolves state-dependent Energy overrides shared by UI and scheduling. */
export function effectiveRevenantEnergyCost(
  context: RevenantEnergyContext,
  skill: RevenantSkill,
): number {
  const schedulerState =
    context.state && "profession" in context.state
      ? context.state
      : undefined;
  const state: Partial<RevenantState> = schedulerState
    ? flattenProfessionState(schedulerState.profession)
    : (
      context.professionState
      || context.state as Partial<RevenantState> | undefined
      || {}
    ) as Partial<RevenantState>;
  const active = (state.activeUpkeeps || []).some(
    (upkeep) => upkeep.skillId === skill.id,
  );
  if (active) return 0;
  if (
    skill.freeWithTraitId != null &&
    hasRevenantTrait(context.config, skill.freeWithTraitId)
  ) {
    return 0;
  }
  if (
    skill.freeWhenStatePositive &&
    Number(
      (state as unknown as Record<string, unknown>)[
        skill.freeWhenStatePositive
      ] || 0,
    ) > 0
  ) {
    return 0;
  }
  const override = (
    state.energyCostOverrides as Record<string, number> | undefined
  )?.[String(skill.id)];
  if (override != null) return Math.max(0, Number(override));
  return Math.max(0, Number(skill.energyCost || 0));
}

/** Pays a cast's Energy cost. */
export function spendRevenantEnergy(
  context: RevenantPrecastContext,
  skill: RevenantSkill,
): void {
  if (
    ([ID.SWAP_LEGENDS, ID.DODGE] as readonly number[])
      .includes(Number(skill.id))
  ) return;
  const state = professionCoreState(context);
  const cost = effectiveRevenantEnergyCost(context, skill);
  state.energy = Math.max(0, state.energy - cost);
  if (cost > 0) {
    emitRevenantState(context, context.start, "energy-spent");
  }
}
