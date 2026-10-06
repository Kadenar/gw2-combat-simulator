import { GW2_ACTION_TICK_MS, quantizeGw2ActionDurationUp } from '#gw2/platform/combat/action-tick.js';
import type { Skill, SkillTask } from '#gw2/platform/skills/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { EPSILON, canonicalTime, timeKey } from '#kernel/core/clock.js';

/** Quickness increases action rate by 50%, so duration is divided by 1.5. */
export const GW2_QUICKNESS_ACTION_RATE = 1.5;

/** The cast-end pair every cast lifecycle context carries, regardless of profession. */
interface Gw2CastEndTimes {
  readonly fullEnd: number;
  readonly effectiveEnd: number;
}

/** A cast that stopped before its full duration was interrupted or cancelled. */
export function castWasInterrupted(cast: Gw2CastEndTimes): boolean {
  return cast.effectiveEnd < cast.fullEnd - EPSILON;
}

/** A cast that reached its full duration. Stated as its own comparison so a non-finite end is neither. */
export function castReachedFullDuration(cast: Gw2CastEndTimes): boolean {
  return cast.effectiveEnd >= cast.fullEnd - EPSILON;
}

/** Cancelled attempts release the cast lane; only committed skills retain their aftercast. */
export function retainsInterruptedCastLockout(skill: Skill | null, cancelledBeforeCommit: boolean): boolean {
  return skill?.retainsCastLockoutAfterInterrupt === true && !cancelledBeforeCommit;
}

/** Snaps observed timing to the nearest GW2 action tick so imported replay values do not retain false precision. */
export function quantizeGw2ActionTimingMs(value: number): number {
  return Math.max(0, Math.round(value / GW2_ACTION_TICK_MS) * GW2_ACTION_TICK_MS);
}

/** Cooldowns become usable on the next absolute action tick, including negative precast timestamps. */
export function gw2CooldownReadyAt(at: number): number {
  if (!Number.isFinite(at)) return at;
  return canonicalTime((Math.ceil(timeKey(at) / (GW2_ACTION_TICK_MS * 1000)) * GW2_ACTION_TICK_MS) / 1000);
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
  // Keep the measured runtime ratio even at nominal 1:1 speed. Its tiny
  // clock-rounding residue preserves event ordering at exact packet boundaries.
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

/** Scheduling and readiness use the same cast-relative deadline, clamped to the live clock. */
export function skillTaskAt(cast: RuntimeCast, trigger: SkillTask, now: number): number {
  const castTimeMs = Number(cast.skill.castTimeMs);
  const scale =
    trigger.timingScale === 'cast' && castTimeMs > 0 ? ((cast.fullEnd - cast.start) * 1000) / castTimeMs : 1;
  const origin =
    trigger.timingAnchor === 'castStart'
      ? cast.start
      : trigger.timingAnchor === 'castCommit'
        ? cast.effectiveEnd
        : cast.fullEnd;
  return canonicalTime(Math.max(now, origin + ((trigger.atMs ?? 0) * scale) / 1000));
}
