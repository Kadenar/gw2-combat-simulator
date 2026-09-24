import type { Skill, StrikeEffect } from '#gw2/platform/engine/skills/types.js';
import {
  castRelativeEffectTimingScale,
  retainsInterruptedCastLockout,
  referenceCastTimeMs,
  quantizeGw2ActionTimingMs
} from '#gw2/platform/skills/timing.js';

/** A shortened atomic input cancels unless a declared skill or effect cutoff has been reached. */
function isUncommittedCast(skill: Skill | null, durationMs: number): boolean {
  if (skill?.interruptMode === 'per-packet') return false;
  const elapsedMs = quantizeGw2ActionTimingMs(durationMs);
  if (elapsedMs >= referenceCastTimeMs(skill)) return false;
  const cutoffs = [skill?.interruptCommitMs, ...(skill?.effects || []).map((effect) => effect.interruptCommitMs)];
  return !cutoffs.some((cutoff) => cutoff != null && Number.isFinite(cutoff) && elapsedMs >= cutoff);
}

/** Keeps imported occupancy consistent with the scheduler's commitment-dependent aftercast. */
export function retainsReplayCastLockout(skill: Skill | null, durationMs: number): boolean {
  return retainsInterruptedCastLockout(skill, isUncommittedCast(skill, durationMs));
}

export { referenceCastTimeMs } from '#gw2/platform/skills/timing.js';

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
  const first = origin + (effect.atMs == null ? runtimeDurationMs - origin : Number(effect.atMs) * castScale);
  return Array.from({ length: hits }, () => first);
}
