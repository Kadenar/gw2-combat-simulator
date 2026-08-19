import { professionCoreState } from '../../../platform/engine/profession.js';
import type { ScheduledTask } from '../../../platform/engine/types.js';
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

export function gainWarriorAdrenaline(context: WarriorSchedulerContext, amount: number): void {
  if (context.config.specialization === 'Bladesworn' && context.state.profession.specialization.kind === 'Bladesworn') {
    const state = context.state.profession.specialization.state;
    state.flow = Math.min(state.maximumFlow, state.flow + Math.max(0, Number(amount || 0)));
    return;
  }

  const state = professionCoreState(context);
  state.adrenaline += Math.max(0, Number(amount || 0));
  syncWarriorAdrenaline(context);
}

export function spendWarriorAdrenaline(context: WarriorCastContext, skill: WarriorSkill): number {
  const state = professionCoreState(context);
  if (!skill.burst && !['warrior.berserk', 'warrior.full-counter', 'warrior.chant'].includes(String(skill.handlerId))) {
    return 0;
  }

  const available = Number(state.adrenaline || 0);
  const requested = Number(skill.adrenalineCost || 0);
  const spend =
    skill.primalBurst ||
    context.config.specialization === 'Spellbreaker' ||
    context.config.specialization === 'Paragon' ||
    skill.handlerId === 'warrior.full-counter' ||
    skill.handlerId === 'warrior.chant'
      ? Math.min(available, requested)
      : skill.handlerId === 'warrior.berserk'
        ? Math.min(available, 30)
        : available;
  state.adrenaline = Math.max(0, available - spend);
  syncWarriorAdrenaline(context);
  return spend;
}

export function applyWarriorSkillResource(context: WarriorCastContext, skill: WarriorSkill): number {
  const spent = spendWarriorAdrenaline(context, skill);
  if (Number(skill.adrenalineGain || 0) > 0) {
    gainWarriorAdrenaline(context, Number(skill.adrenalineGain));
  }

  return spent;
}

export function handleWarriorAdrenalineTask(context: WarriorSchedulerContext, task: ScheduledTask): void {
  const payload = task.payload as { readonly amount?: number } | null;
  gainWarriorAdrenaline(context, Number(payload?.amount || 1));
}
