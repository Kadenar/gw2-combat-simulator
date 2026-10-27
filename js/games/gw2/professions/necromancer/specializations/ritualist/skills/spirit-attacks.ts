import { ACTOR } from '#gw2/platform/constants.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Anguish grants this shared duration-stacking effect; its recurring damage has its own skill owner. */
export const painfulBondSkill: Skill = {
  id: 'ritualist.painful-bond',
  name: 'Painful Bond',
  type: 'Proc',
  simulatorExcluded: true,
  pulseInterval: 1,
  // Preserve the existing first-pulse offset without changing duration stacking or cadence.
  initialDelay: 0.004,
  icon: 'https://render.guildwars2.com/file/9CA8D4479BEE9A28C810CCB0E234BAC7712104A0/3680170.png',
  effects: [
    {
      name: 'necromancer-painful-bond',
      type: 'buff',
      kind: 'necromancer-painful-bond',
      stacks: 1,
      duration: 10,
      actorType: ACTOR.PLAYER
    },
    {
      name: 'Strike',
      type: 'strike',
      coefficient: 0,
      hits: 1,
      flatStrikeBase: 200,
      flatStrikePowerCoeff: 0.4,
      actorType: ACTOR.EFFECT,
      canCrit: false
    }
  ]
};

/** Actor skills own autonomous attacks and calibrated busy/impact tuning without creating player casts. */
export const RITUALIST_SPIRIT_ATTACK_SKILLS: readonly Skill[] = Object.freeze([
  painfulBondSkill,
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
