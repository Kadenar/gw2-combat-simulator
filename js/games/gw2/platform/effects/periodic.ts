import type { SkillEffect } from '#gw2/platform/effects/types.js';

/**
 * Lengthens repeated effects by the applications that fit in an added lifetime, on each effect's own interval.
 * Explicit tick timelines are calibrated one-off schedules and one-shot effects have no interval; both stay unchanged.
 */
export function extendPeriodicEffects(effects: readonly SkillEffect[], extensionMs: number): readonly SkillEffect[] {
  return effects.map((effect) => {
    const intervalMs = Number(effect.intervalMs);
    const added = intervalMs > 0 && !effect.ticks ? Math.floor(extensionMs / intervalMs) : 0;
    return added > 0 ? { ...effect, applications: (effect.applications ?? 1) + added } : effect;
  });
}
