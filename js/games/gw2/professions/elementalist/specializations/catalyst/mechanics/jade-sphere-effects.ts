/**
 * Effect tables for the four Deploy Jade Sphere skills. A sphere pulses six times
 * over five seconds from cast start, each pulse striking for a small coefficient
 * and granting its attunement's boon to the party.
 */
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { SkillEffect } from '#gw2/platform/engine/types.js';

const JADE_SPHERE_TICKS = Object.freeze([0, 1000, 2000, 3000, 4000, 5000]);

// One multi-tick strike plus one party boon effect per tick, all anchored to cast
// start and scaled with cast time so the pulses stay aligned.
function jadeSphereEffects(boon: string, duration: number): readonly SkillEffect[] {
  return [
    {
      type: 'strike',
      ticks: JADE_SPHERE_TICKS.map((atMs) => ({
        atMs,
        coefficient: 0.25,
        damageKind: 'field-tick'
      })),
      timingAnchor: 'castStart',
      timingScale: 'cast'
    },
    ...JADE_SPHERE_TICKS.map((atMs) => ({
      type: 'boon' as const,
      boon,
      stacks: 1,
      duration,
      atMs,
      timingAnchor: 'castStart' as const,
      timingScale: 'cast' as const,
      audience: { recipients: 'party' as const, maximumRecipients: 5 },
      metadata: {}
    }))
  ];
}

/** Per-attunement sphere pulse effects consumed by the Catalyst skill fragments. */
export const CATALYST_JADE_SPHERE_EFFECTS: Readonly<Record<number, readonly SkillEffect[]>> = Object.freeze({
  [ID.DEPLOY_JADE_SPHERE_FIRE]: jadeSphereEffects('Might', 10),
  [ID.DEPLOY_JADE_SPHERE_WATER]: jadeSphereEffects('Resolution', 1),
  [ID.DEPLOY_JADE_SPHERE_AIR]: jadeSphereEffects('Fury', 1),
  [ID.DEPLOY_JADE_SPHERE_EARTH]: jadeSphereEffects('Protection', 1)
});
