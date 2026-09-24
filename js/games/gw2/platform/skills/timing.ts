import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { canonicalTime, EPSILON, timeKey } from '#kernel/core/clock.js';
import { roundHalfToEven } from '#kernel/core/numeric.js';

/** Quickness increases action rate by 50%, so duration is divided by 1.5. */
export const GW2_QUICKNESS_ACTION_RATE = 1.5;
/** GW2 completes calculated cast durations on 40 ms action-tick boundaries. */
export const GW2_ACTION_TICK_MS = 40;

/** The cast-end pair every cast lifecycle context carries, regardless of profession. */
export interface Gw2CastEndTimes {
  readonly fullEnd: number;
  readonly effectiveEnd: number;
}

/** A cast that stopped before its full duration was interrupted or cancelled. */
export function castWasInterrupted(cast: Gw2CastEndTimes): boolean {
  return cast.effectiveEnd < cast.fullEnd - EPSILON;
}

/** A cast that reached its full duration. Stated as its own comparison so a non-finite end is neither. */
export function castCompleted(cast: Gw2CastEndTimes): boolean {
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

/** Rounds a positive duration up to the next server/action interval. */
export function quantizeGw2ActionDurationUp(value: number, interval = GW2_ACTION_TICK_MS): number {
  if (!(value > 0)) return 0;
  // The epsilon keeps an exact boundary from rounding into the next action tick.
  return Math.ceil(value / interval - 1e-9) * interval;
}

/** Cooldowns become usable on the next absolute action tick, including negative precast timestamps. */
export function gw2CooldownReadyAt(at: number): number {
  if (!Number.isFinite(at)) return at;
  return canonicalTime((Math.ceil(timeKey(at) / (GW2_ACTION_TICK_MS * 1000)) * GW2_ACTION_TICK_MS) / 1000);
}

/** Expires temporary effects on the next absolute action tick without changing their stored duration. */
export function gw2EffectExpiresAt(at: number, duration: number): number {
  const appliedAt = canonicalTime(at);
  if (!(duration > 0)) return appliedAt;
  return canonicalTime(quantizeGw2ActionDurationUp((appliedAt + duration) * 1000) / 1000);
}

/**
 * Returns a summon's Quickness timeline used to author cast-scaled effect packets.
 * Explicit measurements win; otherwise the standard action-rate conversion is
 * rounded to the next action tick.
 */
export function summonQuicknessCastTimeMs(skill: Skill | null, fallbackBaseMs?: number): number {
  const baseMs = Math.max(0, Number(fallbackBaseMs ?? skill?.castTimeMs ?? 0));
  const explicitMs = Math.max(0, Number(skill?.quicknessCastTimeMs ?? 0));
  if (explicitMs > 0) return explicitMs;
  return quantizeGw2ActionDurationUp(baseMs / GW2_QUICKNESS_ACTION_RATE);
}

/** Player durations are effective timings; independent summon casts retain their own action-rate model. */
export function referenceCastTimeMs(skill: Skill | null): number {
  return skill?.independentCast || skill?.quicknessCastTimeMs != null
    ? summonQuicknessCastTimeMs(skill)
    : Math.max(0, Number(skill?.castTimeMs ?? 0));
}

/** Projects an authored effect timeline onto a skill variant's actual cast length. */
export function castRelativeEffectTimingScale(skill: Skill, runtimeCastMs: number): number {
  const referenceMs = referenceCastTimeMs(skill);
  if (!(referenceMs > 0)) return 1;
  const runtimeMs = Math.max(0, Number(runtimeCastMs));
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
    return Number(authoredMs) * castRelativeEffectTimingScale(skill, runtimeCastMs);
  }

  const baseMs = Math.max(0, Number(skill.castTimeMs || 0));
  const referenceMs = referenceCastTimeMs(skill);
  if (!(baseMs > 0) || !(referenceMs > 0)) return Number(authoredMs);
  const baseTimelineMs = (Number(authoredMs) * baseMs) / referenceMs;
  return baseTimelineMs * (Math.max(0, Number(runtimeCastMs)) / baseMs);
}

/** Final effect durations use half-even whole milliseconds; expiration stays relative to the application time. */
export function roundEffectDuration(duration: number): number {
  if (!Number.isFinite(duration)) throw new RangeError('Effect duration must be finite.');
  return roundHalfToEven(Math.max(0, duration) * 1000) / 1000;
}
