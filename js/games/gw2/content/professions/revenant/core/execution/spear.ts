/** Materializes Abyssal Raze packets while Crushing Abyss lifetime state stays in mechanics. */
import { emitSkillCondition, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import {
  conditionEffectTicks,
  effectFirstAtMs,
  strikeEffectCoefficient
} from '#gw2/platform/engine/effects/timelines.js';
import {
  completeCrushingAbyssWeaponSwap,
  consumeCrushingAbyssWeaponSwap,
  CRUSHING_GAIN_TASK,
  crushingAbyssStacksAt,
  scheduleAbyssalRazeRechargeReduction
} from '#gw2/content/professions/revenant/core/mechanics/crushing-abyss.js';
import type {
  RevenantCastContext,
  RevenantScheduledTask,
  RevenantSchedulerContext,
  RevenantSkill
} from '#gw2/content/professions/revenant/types.js';

// Replace Abyssal Raze's declarative profile with stack-scaled strike and Torment packets.
function emitAbyssalRazePackets(
  context: RevenantSchedulerContext,
  skill: RevenantSkill,
  at: number,
  crushingAbyssStacks: number,
  triggeredBy = ''
): void {
  const strike = skill.effects?.find((effect) => effect.type === 'strike');
  const conditions = skill.effects?.filter((effect) => effect.type === 'condition');
  const baseTorment = conditions?.find((effect) => !effect.metadata?.trigger);
  const crushingTorment = conditions?.find((effect) => effect.metadata?.trigger === 'crushing-abyss');
  if (!strike || !baseTorment || !crushingTorment) {
    throw new Error('Abyssal Raze is missing its declarative effects.');
  }

  const baseCoefficient = strikeEffectCoefficient(strike);
  const coefficient = triggeredBy
    ? baseCoefficient
    : baseCoefficient * (1 + Number(strike.damageIncreasePerStack || 0) * crushingAbyssStacks);
  const baseTormentTick = conditionEffectTicks(baseTorment)[0];
  const crushingTormentTick = conditionEffectTicks(crushingTorment)[0];
  const common = {
    at,
    source: 'revenant',
    sourceId: skill.id,
    actorType: 'player' as const,
    skillId: skill.id,
    skillName: skill.name,
    skillWeapon: 'Spear',
    ...(triggeredBy ? { triggeredBy } : {})
  };
  emitSkillDamage(context, {
    ...common,
    name: triggeredBy ? 'Abyssal Raze — Crushing Abyss' : 'Abyssal Raze',
    coefficient,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    crushingAbyssStacks
  });
  emitSkillCondition(context, {
    ...common,
    name: 'Abyssal Raze — Torment',
    condition: 'Torment',
    stacks: Number(baseTormentTick?.stacks || 0),
    duration: Number(baseTormentTick?.duration || 0)
  });
  if (crushingAbyssStacks > 0) {
    emitSkillCondition(context, {
      ...common,
      name: 'Abyssal Raze — Crushing Abyss Torment',
      condition: 'Torment',
      stacks: Number(crushingTormentTick?.stacks || 0) * crushingAbyssStacks,
      duration: Number(crushingTormentTick?.duration || 0),
      crushingAbyssStacks
    });
  }
}

/** Replaces Abyssal Raze's packets with its current stack-scaled profile. */
export function castAbyssalRaze(context: RevenantCastContext, skill: RevenantSkill): void {
  const strike = skill.effects?.find((effect) => effect.type === 'strike');
  if (!strike) throw new Error('Abyssal Raze is missing its strike effect.');
  const at = context.start + Number(effectFirstAtMs(strike) || 0) / 1000;
  emitAbyssalRazePackets(context, skill, at, crushingAbyssStacksAt(professionCoreState(context), at));
  context.tasks.schedule({
    id: `${CRUSHING_GAIN_TASK}:${context.reservationId}`,
    type: CRUSHING_GAIN_TASK,
    at,
    payload: {}
  });
}

/** Emits the max-stack Raze owned by a qualifying weapon swap, then publishes cleared state. */
export function handleCrushingAbyssWeaponSwap(
  context: RevenantSchedulerContext,
  task: RevenantScheduledTask<{ weaponSet?: number }>
): void {
  const consumed = consumeCrushingAbyssWeaponSwap(context, task);
  if (!consumed) return;
  emitAbyssalRazePackets(context, consumed.skill, task.at, consumed.stacks, 'Swap Weapons');
  completeCrushingAbyssWeaponSwap(context, task.at);
}

export const revenantSpearSkillHandlers = Object.freeze({
  'revenant.spear-recharge': scheduleAbyssalRazeRechargeReduction,
  'revenant.abyssal-raze': castAbyssalRaze
});
