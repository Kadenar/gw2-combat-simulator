import type { ScheduledTask } from '../../platform/engine/types.js';
import { gainCoreWarriorAdrenaline, spendCoreWarriorAdrenaline } from './core/resources.js';
import { gainBladeswornFlow, bladeswornGainsAdrenalineOnHit } from './specializations/bladesworn/resources.js';
import { spendBerserkerAdrenaline } from './specializations/berserker/resources.js';
import { spendParagonAdrenaline } from './specializations/paragon/resources.js';
import { spendSpellbreakerAdrenaline } from './specializations/spellbreaker/resources.js';
import type { WarriorCastContext, WarriorSchedulerContext, WarriorSkill } from './types.js';

function specializationKind(context: WarriorSchedulerContext): string {
  return context.state.profession.specialization.kind;
}

/** Routes a family resource gain through the active specialization's conversion policy. */
export function gainWarriorAdrenaline(context: WarriorSchedulerContext, amount: number): void {
  if (specializationKind(context) === 'Bladesworn') {
    gainBladeswornFlow(context, amount);
    return;
  }

  gainCoreWarriorAdrenaline(context, amount);
}

/** Routes a resource spend to the slice that owns the active profession mechanic. */
export function spendWarriorAdrenaline(context: WarriorCastContext, skill: WarriorSkill): number {
  switch (specializationKind(context)) {
    case 'Berserker':
      return spendBerserkerAdrenaline(context, skill);
    case 'Spellbreaker':
      return spendSpellbreakerAdrenaline(context, skill);
    case 'Paragon':
      return spendParagonAdrenaline(context, skill);
    default:
      return spendCoreWarriorAdrenaline(context, skill);
  }
}

/** Applies the selected spend policy before routing any skill-authored resource gain. */
export function applyWarriorSkillResource(context: WarriorCastContext, skill: WarriorSkill): number {
  const spent = spendWarriorAdrenaline(context, skill);

  if (Number(skill.adrenalineGain || 0) > 0) {
    gainWarriorAdrenaline(context, Number(skill.adrenalineGain));
  }

  return spent;
}

/** Reports whether ordinary strike packets feed the active slice's resource loop. */
export function warriorGainsAdrenalineOnHit(context: WarriorSchedulerContext): boolean {
  return specializationKind(context) === 'Bladesworn' ? bladeswornGainsAdrenalineOnHit() : true;
}

/** Applies deferred strike-resource gains through the active family policy. */
export function handleWarriorAdrenalineTask(context: WarriorSchedulerContext, task: ScheduledTask): void {
  const payload = task.payload as { readonly amount?: number } | null;
  gainWarriorAdrenaline(context, Number(payload?.amount || 1));
}
