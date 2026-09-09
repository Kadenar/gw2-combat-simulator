import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { StrikeEffect } from '#gw2/platform/engine/skills/types.js';
import { emitSkillCondition, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { projectCastRelativeEffectTimingMs } from '#gw2/platform/skills/timing.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { emitRevenantStateSnapshot } from '#gw2/professions/revenant/state.js';
import type {
  RevenantCastContext,
  RevenantScheduledTask,
  RevenantSchedulerContext,
  RevenantSkill
} from '#gw2/professions/revenant/types.js';

const AURA_TASK = 'revenant.blossoming-aura';

/** Only the initial impact follows cast speed; the attached aura then ticks on a fixed fuse. */
export function activateBlossomingAura(context: RevenantCastContext, skill: RevenantSkill): void {
  if (context.action?.cancelled) return;
  const pulse = skill.effects?.find((effect) => effect.type === 'strike' && effect.name === 'Pulsing Damage');
  const ticks = (pulse as StrikeEffect | undefined)?.ticks;
  if (!ticks?.length) throw new Error('Blossoming Aura is missing its pulse ticks.');
  const firstAt =
    context.start +
    projectCastRelativeEffectTimingMs(skill, (context.fullEnd - context.start) * 1000, ticks[0].atMs) / 1000;
  context.tasks.cancelOwner(AURA_TASK);
  for (let index = 0; index <= ticks.length; index += 1) {
    context.tasks.schedule({
      type: AURA_TASK,
      ownerId: AURA_TASK,
      at: firstAt + (index === ticks.length ? Number(skill.duration) : index * Number(skill.pulseInterval)),
      payload: { index }
    });
  }
}

/** Manual and automatic detonation share scaling and cancel the remaining fuse without touching recharge. */
function detonate(context: RevenantSchedulerContext, at: number): void {
  const state = professionCoreState(context);
  const expiresAt = Number(state.availableFlips[ID.DETONATE_BLOSSOMING_AURA] || 0);
  if (!expiresAt) return;
  const skill = context.catalog.skillsById.get(ID.BLOSSOMING_AURA)!;
  const final = skill.effects?.find((effect) => effect.type === 'strike' && effect.name === 'Final Damage');
  if (!final) throw new Error('Blossoming Aura is missing its final strike.');
  const stacks = Math.min(
    3,
    Math.max(0, Math.floor((at - expiresAt + Number(skill.duration) + 1e-9) / Number(skill.pulseInterval)))
  );
  emitSkillDamage(context, skill, {
    at,
    name: final.name,
    coefficient: Number(final.coefficient) * (1 + Number(final.damageIncreasePerStack) * stacks)
  });
  for (const effect of skill.effects || []) {
    if (effect.type === 'condition' && effect.condition)
      emitSkillCondition(context, skill, {
        at,
        condition: effect.condition,
        stacks: Number(effect.stacks),
        duration: Number(effect.duration)
      });
  }

  delete state.availableFlips[ID.DETONATE_BLOSSOMING_AURA];
  context.tasks.cancelOwner(AURA_TASK);
  emitRevenantStateSnapshot(context, at, 'blossoming-aura-detonated');
}

export function detonateBlossomingAura(context: RevenantCastContext): void {
  if (!context.action?.cancelled) detonate(context, context.start);
}

/** Apply each pulse at its task time so detonation can suppress all later packets. */
export function handleBlossomingAura(context: RevenantSchedulerContext, task: RevenantScheduledTask): void {
  const skill = context.catalog.skillsById.get(ID.BLOSSOMING_AURA)!;
  const pulse = skill.effects?.find((effect) => effect.type === 'strike' && effect.name === 'Pulsing Damage');
  const ticks = (pulse as StrikeEffect | undefined)?.ticks;
  if (!ticks?.length) throw new Error('Blossoming Aura is missing its pulse ticks.');
  const index = Number(task.payload?.index);
  if (index === ticks.length) {
    detonate(context, task.at);
    return;
  }

  if (index === 0) {
    professionCoreState(context).availableFlips[ID.DETONATE_BLOSSOMING_AURA] = task.at + Number(skill.duration);
    emitRevenantStateSnapshot(context, task.at, 'blossoming-aura-armed');
  }

  emitSkillDamage(context, skill, {
    at: task.at,
    name: pulse!.name,
    coefficient: Number(ticks[index].coefficient),
    hitIndex: index + 1,
    totalHits: ticks.length
  });
}
