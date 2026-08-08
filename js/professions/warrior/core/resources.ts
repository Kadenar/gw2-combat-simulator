import { professionCoreState } from "../../../platform/engine/profession.js";
import type { ScheduledTask } from "../../../platform/engine/types.js";
import type {
  WarriorCastContext,
  WarriorSchedulerContext,
  WarriorSkill,
} from "../types.js";

export function syncWarriorAdrenaline(context: WarriorSchedulerContext): void {
  const state = professionCoreState(context);
  state.adrenaline = Math.max(
    0,
    Math.min(state.maximumAdrenaline, Number(state.adrenaline || 0)),
  );
  state.resource = state.adrenaline;
}

export function gainWarriorAdrenaline(
  context: WarriorSchedulerContext,
  amount: number,
): void {
  const state = professionCoreState(context);
  state.adrenaline += Math.max(0, Number(amount || 0));
  syncWarriorAdrenaline(context);
}

export function spendWarriorAdrenaline(
  context: WarriorCastContext,
  skill: WarriorSkill,
): number {
  const state = professionCoreState(context);
  if (
    !skill.burst &&
    !["warrior.berserk", "warrior.full-counter", "warrior.chant"].includes(
      String(skill.handlerId),
    )
  ) {
    return 0;
  }
  const available = Number(state.adrenaline || 0);
  const requested = Number(skill.adrenalineCost || 0);
  const spend =
    skill.primalBurst ||
    context.config.specialization === "Spellbreaker" ||
    context.config.specialization === "Paragon" ||
    skill.handlerId === "warrior.full-counter" ||
    skill.handlerId === "warrior.chant"
      ? Math.min(available, requested)
      : skill.handlerId === "warrior.berserk"
        ? Math.min(available, 30)
        : available;
  state.adrenaline = Math.max(0, available - spend);
  syncWarriorAdrenaline(context);
  return spend;
}

export function applyWarriorSkillResource(
  context: WarriorCastContext,
  skill: WarriorSkill,
): number {
  const spent = spendWarriorAdrenaline(context, skill);
  if (Number(skill.adrenalineGain || 0) > 0) {
    gainWarriorAdrenaline(context, Number(skill.adrenalineGain));
  }
  return spent;
}

export function handleWarriorAdrenalineTask(
  context: WarriorSchedulerContext,
  task: ScheduledTask,
): void {
  const payload = task.payload as { readonly amount?: number } | null;
  gainWarriorAdrenaline(context, Number(payload?.amount || 1));
}
