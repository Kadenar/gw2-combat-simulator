import { professionCoreState } from '../../../../platform/engine/profession/state.js';
import { advanceEndurance, enduranceReadyAt, grantEndurance } from '../../../../platform/combat/resources/endurance.js';
import type { WarriorCastContext, WarriorSchedulerContext, WarriorSkill } from '../types.js';
import { warriorBalanceProfile, WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

function warriorEnduranceRegenerationRate(context: WarriorSchedulerContext, at: number): number {
  const vigor = Boolean(context.config.boons?.vigor || context.hasBuff?.('vigor', at));
  const resources = warriorBalanceProfile(context, PROFILE.resources);
  const base = Number(resources?.enduranceRegenerationPerSecond || 5);
  const vigorMultiplier = Number(resources?.vigorRegenerationMultiplier || 1.5);
  return base * (vigor ? vigorMultiplier : 1);
}

export function advanceWarriorResources(context: WarriorSchedulerContext, target: number): void {
  const state = professionCoreState(context);
  const from = Number(state.enduranceUpdatedAt || 0);
  if (target <= from) return;
  Object.assign(
    state,
    advanceEndurance(
      state,
      target,
      warriorEnduranceRegenerationRate(context, (from + target) / 2),
      state.maximumEndurance
    )
  );
}

export function warriorEnduranceReadyAt(context: WarriorCastContext, cost: number): number | null {
  const rate = warriorEnduranceRegenerationRate(context, context.start);
  return enduranceReadyAt(
    professionCoreState(context).endurance,
    Number(cost || 0),
    context.start,
    rate,
    context.epsilon
  );
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

/** Spends all available adrenaline for a normal Core burst. */
export function spendCoreWarriorAdrenaline(context: WarriorCastContext, skill: WarriorSkill): number {
  const state = professionCoreState(context);
  if (!skill.burst) return 0;

  const available = Number(state.adrenaline || 0);
  state.adrenaline = 0;
  syncWarriorAdrenaline(context);
  return available;
}
