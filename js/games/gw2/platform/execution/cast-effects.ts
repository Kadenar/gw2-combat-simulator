import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { castReachedFullDuration } from '#gw2/platform/execution/cast-timing.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { EPSILON } from '#kernel/core/clock.js';

/** Which authored effects a cast fires: the variant selected at acceptance, and what survives an interruption. */

/** Select one authored variant at acceptance; its packets retain normal timing, cancellation, and attribution. */
export function selectSkillEffects(runtime: MechanicContext, cast: RuntimeCast): readonly SkillEffect[] {
  const variant = cast.skill.effectVariants?.find((candidate) => candidate.when(runtime.queries, cast));
  if (!variant) return cast.skill.effects ?? [];
  // An intrinsic acceptance transform uses the selected skill payload without copying it into a second profile.
  const effects =
    (variant.profileId == null ? cast.skill : requireBalanceProfileFromContext(runtime, variant.profileId)).effects ??
    [];
  return variant.transform?.(runtime, cast, effects) ?? effects;
}

/** Collects every explicit cutoff that can preserve an interrupted commit-mode skill effect. */
export function interruptCommitCutoffs(skill: Skill): number[] {
  return [skill.interruptCommitMs, ...(skill.effects || []).map((effect) => effect.interruptCommitMs)].filter(
    (cutoff): cutoff is number => cutoff != null && Number.isFinite(cutoff)
  );
}

/** True when an interrupted commit-mode cast ended before every declared cutoff (or declares none), so nothing commits. */
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
