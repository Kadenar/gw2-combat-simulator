import { quantizeGw2ActionTimingMs } from '#gw2/platform/combat/action-tick.js';
import type { StrikeEffect } from '#gw2/platform/effects/types.js';
import {
  castRelativeEffectTimingScale,
  referenceCastTimeMs,
  retainsInterruptedCastLockout
} from '#gw2/platform/execution/cast-timing.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** A shortened atomic input cancels unless a declared skill or effect cutoff has been reached. */
function isUncommittedCast(skill: Skill | null, elapsedMs: number): boolean {
  if (skill?.interruptMode === 'per-packet') return false;

  if (elapsedMs >= referenceCastTimeMs(skill)) return false;

  const cutoffs = [skill?.interruptCommitMs, ...(skill?.effects || []).map((effect) => effect.interruptCommitMs)];
  return !cutoffs.some((cutoff) => cutoff != null && Number.isFinite(cutoff) && elapsedMs >= cutoff);
}

/** Quantize once so imported commitment and lockout release use the same replay duration. */
export function retainsReplayCastLockout(skill: Skill | null, durationMs: number): boolean {
  const elapsedMs = quantizeGw2ActionTimingMs(durationMs);
  return retainsInterruptedCastLockout(skill, {
    start: 0,
    effectiveEnd: elapsedMs / 1000,
    cancelledBeforeCommit: isUncommittedCast(skill, elapsedMs)
  });
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
