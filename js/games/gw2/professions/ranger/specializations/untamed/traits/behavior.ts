import type { SkillEffect } from '#gw2/platform/effects/types.js';

/** Ambushes own the delivery time; their accepted proc resolves the selected trait balance at impact. */
export function naturalFortitudeAmbushEffect(atMs: number): SkillEffect {
  return {
    type: 'custom',
    eventType: 'ranger.natural-fortitude',
    event: {},
    atMs,
    timingAnchor: 'castStart',
    timingScale: 'fixed'
  };
}
