import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { castReachedFullDuration } from '#gw2/platform/execution/cast-timing.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { EPSILON } from '#kernel/core/clock.js';

/** Collects every explicit cutoff that can preserve an interrupted commit-mode skill effect. */
export function interruptCommitCutoffs(skill: Skill): number[] {
  return [skill.interruptCommitMs, ...(skill.effects || []).map((effect) => effect.interruptCommitMs)].filter(
    (cutoff): cutoff is number => cutoff != null && Number.isFinite(cutoff)
  );
}

export function cancelledBeforeInterruptCommit(
  skill: Skill,
  start: number,
  fullEnd: number,
  effectiveEnd: number
): boolean {
  if (skill.interruptMode === 'per-packet' || castReachedFullDuration({ fullEnd, effectiveEnd })) return false;
  const elapsedMs = (effectiveEnd - start) * 1000;
  const cutoffs = interruptCommitCutoffs(skill);
  return cutoffs.length === 0 || cutoffs.every((cutoff) => elapsedMs + EPSILON * 1000 < cutoff);
}

/** Returns whether an interrupted cast ended before this persistent effect launched. */
export function cancelledBeforeEffectCommit(
  skill: Skill,
  effect: SkillEffect,
  start: number,
  fullEnd: number,
  effectiveEnd: number
): boolean {
  if (castReachedFullDuration({ fullEnd, effectiveEnd })) return false;
  const cutoff = effect.interruptCommitMs ?? skill.interruptCommitMs;
  if (cutoff == null) return true;
  const elapsedMs = (effectiveEnd - start) * 1000;
  return elapsedMs + EPSILON * 1000 < cutoff;
}
