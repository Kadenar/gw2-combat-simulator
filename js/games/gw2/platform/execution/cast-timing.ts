import { quantizeGw2ActionDurationUp } from '#gw2/platform/combat/action-tick.js';
import { effectTicks, type SkillEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { Skill, SkillTask } from '#gw2/platform/skills/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Quickness increases action rate by 50%, so duration is divided by 1.5. */
export const GW2_QUICKNESS_ACTION_RATE = 1.5;

/** The cast-end pair every cast lifecycle context carries, regardless of profession. */
interface Gw2CastEndTimes {
  readonly fullEnd: number;
  readonly effectiveEnd: number;
}

/** Compare scheduler instants so interruption has no grace window before completion. */
export function castWasInterrupted(cast: Gw2CastEndTimes): boolean {
  return (
    Number.isFinite(cast.effectiveEnd) &&
    Number.isFinite(cast.fullEnd) &&
    canonicalTime(cast.effectiveEnd) < canonicalTime(cast.fullEnd)
  );
}

/** A cast that reached its full duration. Stated as its own comparison so a non-finite end is neither. */
export function castReachedFullDuration(cast: Gw2CastEndTimes): boolean {
  return (
    Number.isFinite(cast.effectiveEnd) &&
    Number.isFinite(cast.fullEnd) &&
    canonicalTime(cast.effectiveEnd) >= canonicalTime(cast.fullEnd)
  );
}

/** Use accepted clock instants so an interruption at the release threshold immediately frees the cast lane. */
export function retainsInterruptedCastLockout(
  skill: Skill | null,
  cast: Pick<RuntimeCast, 'start' | 'effectiveEnd' | 'cancelledBeforeCommit'>
): boolean {
  if (skill?.retainsCastLockoutAfterInterrupt !== true || cast.cancelledBeforeCommit) return false;

  return (
    skill.interruptLockoutReleaseMs == null ||
    canonicalTime(cast.effectiveEnd) < canonicalTime(cast.start + skill.interruptLockoutReleaseMs / 1000)
  );
}

/**
 * Returns a summon's Quickness timeline used to author cast-scaled effect packets.
 * Explicit measurements win; otherwise the standard action-rate conversion is
 * rounded to the next action tick.
 */
export function summonQuicknessCastTimeMs(skill: Skill | null, fallbackBaseMs?: number): number {
  const baseMs = Math.max(0, fallbackBaseMs ?? skill?.castTimeMs ?? 0);
  const explicitMs = Math.max(0, skill?.quicknessCastTimeMs ?? 0);

  if (explicitMs > 0) return explicitMs;

  return quantizeGw2ActionDurationUp(baseMs / GW2_QUICKNESS_ACTION_RATE);
}

/** Player durations are effective timings; independent summon casts retain their own action-rate model. */
export function referenceCastTimeMs(skill: Skill | null): number {
  return skill?.independentCast || skill?.quicknessCastTimeMs != null
    ? summonQuicknessCastTimeMs(skill)
    : Math.max(0, skill?.castTimeMs ?? 0);
}

/** Projects an authored effect timeline onto a skill variant's actual cast length. */
export function castRelativeEffectTimingScale(skill: Skill, runtimeCastMs: number): number {
  const referenceMs = referenceCastTimeMs(skill);

  if (!(referenceMs > 0)) return 1;

  const runtimeMs = Math.max(0, runtimeCastMs);
  // Preserve the runtime ratio while projecting packets; the materializer canonicalizes their absolute deadlines.
  return runtimeMs / referenceMs;
}

/**
 * Projects player packets directly; summon packets retain their existing
 * base-timeline arithmetic order at exact event boundaries.
 */
export function projectCastRelativeEffectTimingMs(skill: Skill, runtimeCastMs: number, authoredMs: number): number {
  if (!skill.independentCast && skill.quicknessCastTimeMs == null) {
    return authoredMs * castRelativeEffectTimingScale(skill, runtimeCastMs);
  }

  const baseMs = Math.max(0, skill.castTimeMs || 0);
  const referenceMs = referenceCastTimeMs(skill);

  if (!(baseMs > 0) || !(referenceMs > 0)) return authoredMs;

  const baseTimelineMs = (authoredMs * baseMs) / referenceMs;
  return baseTimelineMs * (Math.max(0, runtimeCastMs) / baseMs);
}

/** Projects authored timing onto a runtime cast, preserving fixed intervals and the declared anchor. */
export function scaleCastBoundTiming(
  context: { start: number; fullEnd: number },
  skill: Skill,
  effect: SkillEffect
): SkillEffect {
  if (effect.timingScale !== 'cast' || !(Number(skill.castTimeMs) > 0)) return effect;

  const adjustedCastMs = Math.max(0, context.fullEnd - context.start) * 1000;
  const ticks = effectTicks(effect);
  const firstTickAtMs = ticks ? ticks[0]?.atMs || 0 : 0;
  // Return a copy because skill metadata is shared by every simulation run.
  return {
    ...effect,
    ...(ticks
      ? {
          ticks: ticks.map((tick) => ({
            ...tick,
            atMs:
              effect.intervalTimingScale === 'fixed'
                ? projectCastRelativeEffectTimingMs(skill, adjustedCastMs, firstTickAtMs) + tick.atMs - firstTickAtMs
                : projectCastRelativeEffectTimingMs(skill, adjustedCastMs, tick.atMs)
          }))
        }
      : {}),
    ...(effect.atMs == null ? {} : { atMs: projectCastRelativeEffectTimingMs(skill, adjustedCastMs, effect.atMs) }),
    ...(effect.intervalMs == null || effect.intervalTimingScale === 'fixed'
      ? {}
      : { intervalMs: projectCastRelativeEffectTimingMs(skill, adjustedCastMs, effect.intervalMs) })
  } as SkillEffect;
}

/** Scheduling and readiness use the same cast-relative deadline, clamped to the live clock. */
export function skillTaskAt(cast: RuntimeCast, taskDefinition: SkillTask, now: number): number {
  const castTimeMs = Number(cast.skill.castTimeMs);
  const scale =
    taskDefinition.timingScale === 'cast' && castTimeMs > 0 ? ((cast.fullEnd - cast.start) * 1000) / castTimeMs : 1;
  const origin =
    taskDefinition.timingAnchor === 'castStart'
      ? cast.start
      : taskDefinition.timingAnchor === 'castCommit'
        ? cast.effectiveEnd
        : cast.fullEnd;
  return canonicalTime(Math.max(now, origin + ((taskDefinition.atMs ?? 0) * scale) / 1000));
}
