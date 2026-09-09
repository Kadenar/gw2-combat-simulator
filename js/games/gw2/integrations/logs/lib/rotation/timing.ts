import type { Skill, StrikeEffect } from '#gw2/platform/engine/skills/types.js';
import {
  castRelativeEffectTimingScale,
  retainsInterruptedCastLockout,
  quicknessReferenceCastTimeMs,
  quantizeGw2ActionTimingMs
} from '#gw2/platform/skills/timing.js';

/** Preserve channel cancellation evidence so rounding cannot launch an extra packet; atomic casts keep tick snapping. */
export function replayInterruptDurationMs(skill: Skill | null, durationMs: number): number {
  return skill?.interruptMode === 'per-packet' ? Math.max(0, durationMs) : quantizeGw2ActionTimingMs(durationMs);
}

/** A shortened atomic input cancels unless a declared skill or effect cutoff has been reached. */
export function isUncommittedCast(skill: Skill | null, durationMs: number): boolean {
  if (skill?.interruptMode === 'per-packet') return false;
  const elapsedMs = quantizeGw2ActionTimingMs(durationMs);
  if (elapsedMs >= quicknessReferenceCastTimeMs(skill)) return false;
  const cutoffs = [skill?.interruptCommitMs, ...(skill?.effects || []).map((effect) => effect.interruptCommitMs)];
  return !cutoffs.some((cutoff) => cutoff != null && Number.isFinite(cutoff) && elapsedMs >= cutoff);
}

/** Keeps imported occupancy consistent with the scheduler's commitment-dependent aftercast. */
export function retainsReplayCastLockout(skill: Skill | null, durationMs: number): boolean {
  return retainsInterruptedCastLockout(skill, isUncommittedCast(skill, durationMs));
}

export function quicknessRuntimeDurationMs(skill: Skill | null): number {
  return quicknessReferenceCastTimeMs(skill);
}

export function strikePacketOffsets(
  skill: Skill,
  effect: StrikeEffect,
  runtimeDurationMs = quicknessRuntimeDurationMs(skill)
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

/** Returns the earliest catalog-modeled strike packet used by either combat-log source to verify commitment. */
export function firstStrikePacketOffsetMs(
  skill: Skill | null,
  runtimeDurationMs = quicknessRuntimeDurationMs(skill),
  options: { readonly explicitOnly?: boolean } = {}
): number | null {
  const offsets = (skill?.effects || []).flatMap((effect) => {
    if (effect.type !== 'strike') return [];
    if (options.explicitOnly === true && effect.atMs == null && !(Array.isArray(effect.ticks) && effect.ticks.length)) {
      return [];
    }

    return strikePacketOffsets(skill!, effect, runtimeDurationMs);
  });
  return offsets.length ? Math.min(...offsets) : null;
}
