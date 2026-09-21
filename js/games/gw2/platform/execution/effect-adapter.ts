import { EPSILON } from '#kernel/core/clock.js';
import { castCompleted, castWasInterrupted } from '#gw2/platform/skills/timing.js';
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import type { SchedulerContext } from '#gw2/platform/execution/types.js';
import type { Skill, SkillEffect } from '#gw2/platform/engine/skills/types.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';

/** Collects every explicit cutoff that can preserve an interrupted commit-mode skill effect. */
export function interruptCommitCutoffs(skill: Skill): number[] {
  return [skill.interruptCommitMs, ...(skill.effects || []).map((effect) => effect.interruptCommitMs)].filter(
    (cutoff): cutoff is number => cutoff != null && Number.isFinite(Number(cutoff))
  );
}

export function cancelledBeforeInterruptCommit(
  skill: Skill,
  start: number,
  fullEnd: number,
  effectiveEnd: number
): boolean {
  if (skill.interruptMode === 'per-packet' || castCompleted({ fullEnd, effectiveEnd })) return false;
  const elapsedMs = (effectiveEnd - start) * 1000;
  const cutoffs = interruptCommitCutoffs(skill);
  return cutoffs.length === 0 || cutoffs.every((cutoff) => elapsedMs + EPSILON * 1000 < Number(cutoff));
}

/** Returns whether an interrupted cast ended before this persistent effect launched. */
function cancelledBeforeEffectCommit(
  skill: Skill,
  effect: SkillEffect,
  start: number,
  fullEnd: number,
  effectiveEnd: number
): boolean {
  if (castCompleted({ fullEnd, effectiveEnd })) return false;
  const cutoff = effect.interruptCommitMs ?? skill.interruptCommitMs;
  if (cutoff == null) return true;
  const elapsedMs = (effectiveEnd - start) * 1000;
  return elapsedMs + EPSILON * 1000 < Number(cutoff);
}

/**
 * Expands declarative skill effects into canonical scheduled events. This is
 * also reusable by replacing handlers after their owning mechanic resolves dynamic effects.
 */
export function scheduleDeclarativeEffects<TProfessionState extends object>(
  context: SchedulerContext<TProfessionState>,
  skill: Skill,
  activationId: string,
  start: number,
  fullEnd: number,
  effectiveEnd: number,
  observeEffect: (event: SimulationEvent, effect: SkillEffect, effectIndex: number) => void = () => {}
): void {
  const interrupted = castWasInterrupted({ fullEnd, effectiveEnd });
  const slotSkill = skill.type === 'Heal' || skill.type === 'Utility' || skill.type === 'Elite';
  const effects = skill.effects || [];
  for (let index = 0; index < effects.length; index += 1) {
    const effect = effects[index];
    const timing =
      context.schedulerPolicy.effectTiming?.(
        {
          ...context,
          skill,
          start,
          fullEnd,
          effectiveEnd
        },
        skill,
        effect
      ) ?? effect;
    const perPacket = skill.interruptMode === 'per-packet';
    const cancelledCommitEffect =
      interrupted && !perPacket && cancelledBeforeEffectCommit(skill, effect, start, fullEnd, effectiveEnd);
    if (cancelledCommitEffect) continue;
    const cancelPendingEffects = interrupted && (perPacket || effect.persistsAfterInterrupt !== true);
    const base = {
      activationId,
      source: effect.source || context.profession.id,
      sourceId: effect.sourceId ?? skill.id,
      actorType: effect.actorType || 'player',
      ...(effect.ownerActorType ? { ownerActorType: effect.ownerActorType } : {}),
      // Preserve explicit child-effect art so result rows do not fall back to the parent skill icon.
      ...(effect.icon ? { icon: effect.icon } : {}),
      skillId: skill.id,
      skillName: skill.name,
      ...(effect.persistsAfterInterrupt === true ? { persistsAfterInterrupt: true } : {})
    };
    const baseDuration =
      effect.type === 'boon' || effect.type === 'buff' ? Math.max(0, Number(effect.duration || 0)) : undefined;
    const duration =
      baseDuration == null
        ? undefined
        : (context.schedulerPolicy.effectDuration?.(context, skill, effect, baseDuration) ?? baseDuration);
    const applications = materializeSkillEffectApplications({
      skill,
      effect: timing,
      start,
      fullEnd,
      baseEvent: base,
      skillWeaponFallback: slotSkill ? 'Unequipped' : '',
      statusDuration: duration
    });

    // Cancellation keeps packets arriving at the boundary and drops pending impacts.
    for (const application of applications) {
      if (cancelPendingEffects && application.at > effectiveEnd + EPSILON) continue;
      observeEffect(context.emit(application.event), effect, index);
    }
  }
}
