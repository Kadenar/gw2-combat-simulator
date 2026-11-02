import { ACTOR } from '#gw2/platform/constants.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { NecromancerSkill } from '#gw2/professions/necromancer/types.js';

/** Anguish grants this shared duration-stacking effect; its recurring damage has its own skill owner. */
export const painfulBondSkill: NecromancerSkill = {
  name: 'Painful Bond',
  icon: 'https://render.guildwars2.com/file/9CA8D4479BEE9A28C810CCB0E234BAC7712104A0/3680170.png',
  id: 'ritualist.painful-bond',
  type: 'Proc',
  rotationInputExcluded: true,
  pulseInterval: 1,
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
export const RITUALIST_SPIRIT_ATTACK_SKILLS: readonly Skill[] = [
  painfulBondSkill,
  {
    name: 'Anguish Autoattack',
    icon: 'https://render.guildwars2.com/file/9CA8D4479BEE9A28C810CCB0E234BAC7712104A0/3680170.png',
    id: 'necromancer.ritualist.anguish.autoattack',
    type: 'Proc',
    rotationInputExcluded: true,
    castTimeMs: 0,
    // Effective autoattack strength fitted across both supplied logs after normalizing live damage modifiers.
    weaponStrength: 1510,
    // Scheduling starts at cast completion, about 80 ms after spawn; the opening finishes 1840 ms later.
    initialBusyMs: 1840,
    resummonBusyMs: 1840,
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
    name: 'Wanderlust Autoattack',
    icon: 'https://render.guildwars2.com/file/604BAC974ED4C76FE95E32BEE6BDB3DE594F9F6C/3680178.png',
    id: 'necromancer.ritualist.wanderlust.autoattack',
    type: 'Proc',
    rotationInputExcluded: true,
    castTimeMs: 0,
    weaponStrength: 1440,
    // Measured from cast completion: replacing an existing Wanderlust adds 120 ms before its opening finishes.
    initialBusyMs: 1400,
    resummonBusyMs: 1520,
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
    name: 'Preservation Autoattack',
    icon: 'https://render.guildwars2.com/file/473E92AE33757816B7205C4759F1F3065346E600/3680173.png',
    id: 'necromancer.ritualist.preservation.autoattack',
    type: 'Proc',
    rotationInputExcluded: true,
    castTimeMs: 0,
    weaponStrength: 1440,
    initialBusyMs: 1640,
    resummonBusyMs: 1640,
    // Its commanded heal occupies the spirit even though healing packets are outside the damage simulation.
    commandBusyMs: 1880,
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
];
