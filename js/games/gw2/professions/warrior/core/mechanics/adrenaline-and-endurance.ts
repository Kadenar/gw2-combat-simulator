import { balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { advanceEndurance, enduranceReadyAt, grantEndurance } from '#gw2/platform/combat/resources/endurance.js';
import { selfBoonIntervals } from '#gw2/platform/combat/state/boon-extensions.js';
import type { WarriorCastContext, WarriorSchedulerContext, WarriorSkill } from '#gw2/professions/warrior/types.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/core/profiles.js';

function warriorEnduranceRegenerationRate(context: WarriorSchedulerContext, vigor: boolean): number {
  const resources = balanceProfileFromContext(context, PROFILE.resources);
  const base = Number(resources?.enduranceRegenerationPerSecond ?? 5);
  const vigorMultiplier = Number(resources?.vigorRegenerationMultiplier ?? 1.5);
  return base * (vigor ? vigorMultiplier : 1);
}

export function advanceWarriorResources(context: WarriorSchedulerContext, target: number): void {
  const state = professionCoreState(context);
  const from = Number(state.enduranceUpdatedAt || 0);
  if (target <= from) return;
  // Integrate pooled Vigor windows so incidental scheduler boundaries cannot change recovery.
  for (const interval of selfBoonIntervals(
    context.events,
    'vigor',
    from,
    target,
    Boolean(context.config.boons?.vigor)
  )) {
    Object.assign(
      state,
      advanceEndurance(
        state,
        interval.end,
        warriorEnduranceRegenerationRate(context, interval.active),
        state.maximumEndurance
      )
    );
  }
}

export function warriorEnduranceReadyAt(context: WarriorCastContext, cost: number): number | null {
  let current = professionCoreState(context).endurance;
  // Predict Dodge affordability using the same Vigor windows as resource advancement.
  for (const interval of selfBoonIntervals(
    context.events,
    'vigor',
    context.start,
    Infinity,
    Boolean(context.config.boons?.vigor)
  )) {
    const rate = warriorEnduranceRegenerationRate(context, interval.active);
    const readyAt = enduranceReadyAt(current, cost, interval.start, rate, context.epsilon);
    if (readyAt != null && readyAt <= interval.end) return readyAt;
    current += (interval.end - interval.start) * rate;
  }

  return null;
}

export function gainWarriorEndurance(context: WarriorSchedulerContext, amount: number, at = context.state.time): void {
  const state = professionCoreState(context);
  Object.assign(state, grantEndurance(state, Number(amount || 0), at, state.maximumEndurance));
}

export function syncWarriorAdrenaline(context: WarriorSchedulerContext): void {
  const state = professionCoreState(context);
  state.adrenaline = Math.max(0, Math.min(state.maximumAdrenaline, Number(state.adrenaline || 0)));
  state.resource = state.adrenaline;
}

/** Applies the base Warrior adrenaline gain contract without specialization conversion. */
export function gainCoreWarriorAdrenaline(context: WarriorSchedulerContext, amount: number): void {
  const state = professionCoreState(context);
  state.adrenaline += Math.max(0, Number(amount || 0));
  syncWarriorAdrenaline(context);
}

/** Spends up to the requested adrenaline and synchronizes the public resource projection. */
export function spendWarriorAdrenalineAmount(context: WarriorCastContext, amount: number): number {
  const state = professionCoreState(context);
  const available = Number(state.adrenaline || 0);
  const spent = Math.min(available, Math.max(0, Number(amount || 0)));
  state.adrenaline = available - spent;
  syncWarriorAdrenaline(context);
  return spent;
}

/** Spends all available adrenaline for a normal Core burst. */
export function spendCoreWarriorAdrenaline(context: WarriorCastContext, skill: WarriorSkill): number {
  const state = professionCoreState(context);
  if (!skill.burst) return 0;

  return spendWarriorAdrenalineAmount(context, Number(state.adrenaline || 0));
}
