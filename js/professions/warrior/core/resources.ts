import { professionCoreState } from '../../../platform/engine/profession/state.js';
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
  state.endurance = Math.min(
    state.maximumEndurance,
    state.endurance + (target - from) * warriorEnduranceRegenerationRate(context, (from + target) / 2)
  );
  state.enduranceUpdatedAt = target;
}

export function warriorEnduranceReadyAt(context: WarriorCastContext, cost: number): number | null {
  const missing = Math.max(0, Number(cost || 0) - professionCoreState(context).endurance);

  if (missing <= context.epsilon) return context.start;
  const rate = warriorEnduranceRegenerationRate(context, context.start);
  return rate > 0 ? context.start + missing / rate : null;
}

export function gainWarriorEndurance(context: WarriorSchedulerContext, amount: number, at = context.state.time): void {
  const state = professionCoreState(context);
  state.endurance = Math.min(state.maximumEndurance, state.endurance + Math.max(0, Number(amount || 0)));
  state.enduranceUpdatedAt = Math.max(state.enduranceUpdatedAt, at);
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

/** Applies only Core Warrior resource semantics for callers that already selected the Core policy. */
export function applyCoreWarriorSkillResource(context: WarriorCastContext, skill: WarriorSkill): number {
  const spent = spendCoreWarriorAdrenaline(context, skill);

  if (Number(skill.adrenalineGain || 0) > 0) {
    gainCoreWarriorAdrenaline(context, Number(skill.adrenalineGain));
  }

  return spent;
}
