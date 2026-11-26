import { quantizeGw2ActionTimingMs } from '#gw2/platform/combat/action-tick.js';
import type { StrikeEffect } from '#gw2/platform/effects/types.js';
import { cancelledBeforeInterruptCommit } from '#gw2/platform/execution/cast-effects.js';
import {
  castLaneEnd,
  castRelativeEffectTimingScale,
  referenceCastTimeMs
} from '#gw2/platform/execution/cast-timing.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Extend an observed duration only when the scheduler would reserve recovery beyond its snapped cut. */
export function replayCastLaneDurationMs(skill: Skill | null, durationMs: number, fullMs: number): number {
  if (durationMs >= fullMs || !skill?.retainsCastLockoutAfterInterrupt) return durationMs;

  const effectiveEnd = quantizeGw2ActionTimingMs(durationMs) / 1000;
  const fullEnd = fullMs / 1000;
  const laneEnd = castLaneEnd(skill, {
    start: 0,
    fullEnd,
    effectiveEnd,
    cancelledBeforeCommit: cancelledBeforeInterruptCommit(skill, 0, fullEnd, effectiveEnd)
  });
  return laneEnd > effectiveEnd ? laneEnd * 1000 : durationMs;
}

export { referenceCastTimeMs } from '#gw2/platform/execution/cast-timing.js';

export function strikePacketOffsets(
  skill: Skill,
  effect: StrikeEffect,
  runtimeDurationMs = referenceCastTimeMs(skill)
): number[] {
  const origin = effect.timingAnchor === 'castEnd' ? runtimeDurationMs : 0;
  const castScale = effect.timingScale === 'cast' ? castRelativeEffectTimingScale(skill, runtimeDurationMs) : 1;

  if (Array.isArray(effect.ticks) && effect.ticks.length) {
    return effect.ticks.map((tick) => origin + Number(tick.atMs) * castScale);
  }

  const hits = Math.max(1, Math.trunc(Number(effect.hits || 1)));
  const applications = Math.max(1, Math.trunc(Number(effect.applications || 1)));
  const intervalMs = Number(effect.intervalMs || 0) * (effect.intervalTimingScale === 'fixed' ? 1 : castScale);
  const first = origin + (effect.atMs == null ? runtimeDurationMs - origin : Number(effect.atMs) * castScale);
  // Repeated applications are spaced like the runtime schedules them; simultaneous hits share one offset.
  return Array.from({ length: hits * applications }, (_, index) => first + Math.floor(index / hits) * intervalMs);
}
