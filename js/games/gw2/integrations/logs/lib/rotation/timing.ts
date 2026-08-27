import type { Skill, StrikeEffect } from '../../../../platform/engine/types.js';
import { castRelativeEffectTimingScale, quicknessReferenceCastTimeMs } from '../../../../platform/skills/timing.js';

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
  const intervalScale = effect.intervalTimingScale === 'fixed' ? 1 : castScale;
  const interval = Math.max(0, Number(effect.intervalMs || 0)) * intervalScale;
  return Array.from({ length: hits }, (_, index) => first + index * interval);
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

/** Places combat one 40 ms action frame before an opening strike so the marker resolves before its damage packet. */
export function openingStrikeCombatStartMs(
  castStartMs: number,
  strikeOffsetMs: number,
  sourceCombatStartMs: number
): number {
  return Math.min(sourceCombatStartMs, castStartMs + Math.max(0, strikeOffsetMs - 40));
}
