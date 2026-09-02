import type { BalanceProfile } from '#gw2/platform/engine/types.js';
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT
} from '#gw2/content/professions/necromancer/data/ids.js';

export const RITUALIST_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'necromancer.ritualist.resources',
  anguish: 'necromancer.ritualist.spirit.anguish',
  wanderlust: 'necromancer.ritualist.spirit.wanderlust',
  preservation: 'necromancer.ritualist.spirit.preservation',
  painfulBond: 'necromancer.ritualist.painful-bond',
  nightmareWeaponProc: 'necromancer.ritualist.nightmare-weapon-proc',
  splinterWeaponProc: 'necromancer.ritualist.splinter-weapon-proc',
  explosiveGrowth: TRAIT.EXPLOSIVE_GROWTH,
  boonOfCreation: TRAIT.BOON_OF_CREATION,
  empoweringSpirits: TRAIT.EMPOWERING_SPIRITS
});

export const RITUALIST_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: RITUALIST_BALANCE_PROFILE_IDS.resources,
    name: 'Ritualist Spirit Cadence',
    profileKind: 'mechanic',
    pulseInterval: 4,
    initialDelay: 7.36,
    lifeForceDrain: 3,
    resummonedSpiritAttackDelayMs: 4140,
    weaponStrength: 1056,
    effects: []
  },
  {
    id: RITUALIST_BALANCE_PROFILE_IDS.anguish,
    name: 'Anguish - Spirit Attacks',
    profileKind: 'skill-variant',
    parentId: ID.ANGUISH,
    weaponStrength: 1685,
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1,
        actorType: 'summon',
        name: 'Anguish Autoattack'
      },
      {
        // EVTC calibration identifies each player-owned barrage packet as a 0.355 coefficient strike.
        type: 'strike',
        ticks: [
          { atMs: 800, coefficient: 0.355 },
          { atMs: 960, coefficient: 0.355 },
          { atMs: 1000, coefficient: 0.355 },
          { atMs: 1080, coefficient: 0.355 },
          { atMs: 1120, coefficient: 0.355 },
          { atMs: 1160, coefficient: 0.355 },
          { atMs: 1200, coefficient: 0.355 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player',
        name: 'Anguish Initial Barrage'
      },
      {
        type: 'strike',
        ticks: Array.from({ length: 4 }, (_, index) => ({ atMs: 360 + index * 320, coefficient: 2.5 / 4 })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        duration: 2,
        actorType: 'player',
        name: 'Summon Spirits - Anguish'
      }
    ]
  },
  {
    id: RITUALIST_BALANCE_PROFILE_IDS.wanderlust,
    name: 'Wanderlust - Spirit Attacks',
    profileKind: 'skill-variant',
    parentId: ID.WANDERLUST,
    weaponStrength: 1565,
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1,
        actorType: 'summon',
        name: 'Wanderlust Autoattack'
      },
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        atMs: 720,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player',
        name: 'Wanderlust Initial Swing'
      },
      {
        // The lingering field emits four independently timed 0.42 coefficient packets.
        type: 'strike',
        ticks: Array.from({ length: 4 }, (_, index) => ({ atMs: 2000 + index * 1000, coefficient: 0.42 })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player',
        name: 'Wanderlust Initial Field'
      },
      {
        type: 'strike',
        coefficient: 3.7,
        hits: 1,
        atMs: 840,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        duration: 1.8,
        actorType: 'player',
        name: 'Summon Spirits - Wanderlust'
      }
    ]
  },
  {
    id: RITUALIST_BALANCE_PROFILE_IDS.preservation,
    name: 'Preservation - Spirit Attacks',
    profileKind: 'skill-variant',
    parentId: ID.PRESERVATION,
    weaponStrength: 1565,
    effects: [
      {
        type: 'strike',
        coefficient: 0.3,
        hits: 1,
        actorType: 'summon',
        name: 'Preservation Autoattack'
      }
    ]
  },
  {
    id: RITUALIST_BALANCE_PROFILE_IDS.painfulBond,
    name: 'Painful Bond',
    profileKind: 'mechanic',
    pulseInterval: 1,
    initialDelay: 0.004,
    icon: 'https://render.guildwars2.com/file/9CA8D4479BEE9A28C810CCB0E234BAC7712104A0/3680170.png',
    effects: [
      {
        type: 'buff',
        kind: 'necromancer-painful-bond',
        stacks: 1,
        duration: 10,
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 0,
        hits: 1,
        flatStrikeBase: 200,
        flatStrikePowerCoeff: 0.4,
        actorType: 'effect',
        noCrit: true
      }
    ]
  },
  {
    id: RITUALIST_BALANCE_PROFILE_IDS.nightmareWeaponProc,
    name: 'Nightmare Weapon - Triggered Attack',
    profileKind: 'skill-variant',
    parentId: ID.NIGHTMARE_WEAPON,
    internalCooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0,
        hits: 1,
        flatStrikeBase: 1200,
        flatStrikePowerCoeff: 0.05,
        actorType: 'effect',
        noCrit: true,
        damageKind: 'life-steal'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 2,
        duration: 8,
        actorType: 'effect'
      }
    ]
  },
  {
    id: RITUALIST_BALANCE_PROFILE_IDS.splinterWeaponProc,
    name: 'Splinter Weapon - Triggered Attack',
    profileKind: 'skill-variant',
    parentId: ID.SPLINTER_WEAPON,
    internalCooldown: 0.25,
    effects: [{ type: 'strike', coefficient: 0.4, hits: 1, actorType: 'effect' }]
  },
  {
    id: RITUALIST_BALANCE_PROFILE_IDS.explosiveGrowth,
    name: 'Explosive Growth',
    profileKind: 'trait',
    categories: ['Trait'],
    coefficientMultiplier: 1.2,
    effects: [{ type: 'strike', coefficient: 1.2, hits: 1, actorType: 'effect' }]
  },
  {
    id: RITUALIST_BALANCE_PROFILE_IDS.boonOfCreation,
    name: 'Boon of Creation',
    profileKind: 'trait',
    categories: ['Trait'],
    attributeBonus: 180,
    lifeForceGain: 10,
    effects: []
  },
  {
    id: RITUALIST_BALANCE_PROFILE_IDS.empoweringSpirits,
    name: 'Empowering Spirits',
    profileKind: 'trait',
    categories: ['Trait'],
    effects: [
      {
        type: 'boon',
        boon: 'quickness',
        stacks: 1,
        duration: 3.75,
        actorType: 'player',
        audience: { recipients: 'party' as const }
      },
      {
        type: 'boon',
        boon: 'might',
        stacks: 8,
        duration: 10,
        actorType: 'player',
        audience: { recipients: 'party' as const }
      },
      {
        type: 'boon',
        boon: 'fury',
        stacks: 1,
        duration: 5,
        actorType: 'player',
        audience: { recipients: 'party' as const }
      },
      {
        type: 'boon',
        boon: 'resolution',
        stacks: 1,
        duration: 4,
        actorType: 'player',
        audience: { recipients: 'party' as const }
      }
    ]
  }
]);

export const RITUALIST_SPIRIT_PROFILE_BY_SKILL_ID: Readonly<Record<number, string>> = Object.freeze({
  [ID.ANGUISH]: RITUALIST_BALANCE_PROFILE_IDS.anguish,
  [ID.WANDERLUST]: RITUALIST_BALANCE_PROFILE_IDS.wanderlust,
  [ID.PRESERVATION]: RITUALIST_BALANCE_PROFILE_IDS.preservation
});
