import { ACTOR } from '#gw2/platform/constants.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Actor skills own autonomous attacks and calibrated busy/impact tuning without creating player casts. */
export const RITUALIST_SPIRIT_ATTACK_SKILLS: readonly Skill[] = Object.freeze([
  {
    id: 'necromancer.ritualist.anguish.autoattack',
    name: 'Anguish Autoattack',
    type: 'Proc',
    simulatorExcluded: true,
    castTimeMs: 0, // Effective autoattack strength fitted across both supplied logs after normalizing live damage modifiers.
    weaponStrength: 1510,
    // Spawn-to-ready includes the spirit's activation delay and its opening animation.
    initialBusyMs: 1920,
    autoattackImpactDelayMs: 840,
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1,
        actorType: ACTOR.SUMMON,
        name: 'Anguish Autoattack'
      }
    ]
  },
  {
    id: 'necromancer.ritualist.wanderlust.autoattack',
    name: 'Wanderlust Autoattack',
    type: 'Proc',
    simulatorExcluded: true,
    castTimeMs: 0,
    weaponStrength: 1440,
    initialBusyMs: 1440,
    autoattackImpactDelayMs: 840,
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1,
        actorType: ACTOR.SUMMON,
        name: 'Wanderlust Autoattack'
      }
    ]
  },
  {
    id: 'necromancer.ritualist.preservation.autoattack',
    name: 'Preservation Autoattack',
    type: 'Proc',
    simulatorExcluded: true,
    castTimeMs: 0,
    weaponStrength: 1440,
    initialBusyMs: 1640,
    // Projectile travel adds some variation; use the later observed action tick at golem range.
    autoattackImpactDelayMs: 920,
    effects: [
      {
        type: 'strike',
        coefficient: 0.3,
        hits: 1,
        actorType: ACTOR.SUMMON,
        name: 'Preservation Autoattack'
      }
    ]
  }
]);
