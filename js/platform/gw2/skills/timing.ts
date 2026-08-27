import type { Skill } from '../../engine/types.js';

/** Quickness increases action rate by 50%, so duration is divided by 1.5. */
export const GW2_QUICKNESS_ACTION_RATE = 1.5;
/** GW2 completes calculated cast durations on 40 ms action-tick boundaries. */
export const GW2_ACTION_TICK_MS = 40;

/** Rounds a positive duration up to the next server/action interval. */
export function quantizeGw2ActionDurationUp(value: number, interval = GW2_ACTION_TICK_MS): number {
  if (!(value > 0)) return 0;
  // The epsilon keeps an exact boundary from rounding into the next action tick.
  return Math.ceil(value / interval - 1e-9) * interval;
}

/**
 * Returns the Quickness timeline used to author cast-scaled effect packets.
 * Explicit measurements win; otherwise the standard action-rate conversion is
 * rounded to the next action tick.
 */
export function quicknessReferenceCastTimeMs(skill: Skill | null, fallbackBaseMs?: number): number {
  const baseMs = Math.max(0, Number(fallbackBaseMs ?? skill?.castTimeMs ?? 0));
  if (skill?.unaffectedByQuickness === true) return baseMs;
  const explicitMs = Math.max(0, Number(skill?.quicknessCastTimeMs ?? 0));
  if (explicitMs > 0) return explicitMs;
  return quantizeGw2ActionDurationUp(baseMs / GW2_QUICKNESS_ACTION_RATE);
}

/**
 * Accepts an observed cast interruption only when skill metadata proves the
 * action committed, and snaps that observation to the nearest action tick.
 */
export function observedCommittedInterruptMs(skill: Skill | null, observedDurationMs: number): number | null {
  if (skill?.interruptCommitMs == null) return null;
  const commitMs = Number(skill.interruptCommitMs);
  if (!Number.isFinite(commitMs) || commitMs < 0) return null;
  const observedMs = Math.round(Math.max(0, Number(observedDurationMs)) / GW2_ACTION_TICK_MS) * GW2_ACTION_TICK_MS;
  const runtimeMs = quicknessReferenceCastTimeMs(skill);
  // Interrupting exactly at the commit point is valid because the skill has committed on that action tick.
  if (!(observedMs > 0) || observedMs < commitMs || observedMs >= runtimeMs) return null;
  return observedMs;
}

/** Projects a Quickness-authored effect timeline onto the actual cast length. */
export function castRelativeEffectTimingScale(skill: Skill, runtimeCastMs: number): number {
  if (skill.unaffectedByQuickness === true) return 1;
  const referenceMs = quicknessReferenceCastTimeMs(skill);
  if (!(referenceMs > 0)) return 1;
  const runtimeMs = Math.max(0, Number(runtimeCastMs));
  // Keep the measured runtime ratio even at nominal 1:1 Quickness. Its tiny
  // clock-rounding residue preserves event ordering at exact packet boundaries.
  return runtimeMs / referenceMs;
}

/**
 * Projects one Quickness-authored timestamp while retaining the prior
 * base-timeline arithmetic order at exact event boundaries.
 */
export function projectCastRelativeEffectTimingMs(skill: Skill, runtimeCastMs: number, authoredMs: number): number {
  if (skill.unaffectedByQuickness === true) return Number(authoredMs);
  const baseMs = Math.max(0, Number(skill.castTimeMs || 0));
  const referenceMs = quicknessReferenceCastTimeMs(skill);
  if (!(baseMs > 0) || !(referenceMs > 0)) return Number(authoredMs);
  const baseTimelineMs = (Number(authoredMs) * baseMs) / referenceMs;
  return baseTimelineMs * (Math.max(0, Number(runtimeCastMs)) / baseMs);
}
