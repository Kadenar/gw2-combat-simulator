import { ELEMENTALIST_SKILL_IDS as ID } from '../data/ids.js';

/** Ally-triggered Lightning Jolt uses unequipped weapon strength against the elemental's fixed damage scale. */
export const ELEMENTAL_LIGHTNING_JOLT_PROFILE = Object.freeze({
  weaponStrengthProfileId: 'nonweapon.unequipped',
  weaponStrength: 690.5,
  damagePerCoefficient: 2500,
  basePower: (2500 * 2597) / 690.5
});

/** Fire Elemental timings and packets measured from a 2026-07-16 ArcDPS log. */
export const FIRE_ELEMENTAL_EVTC_PROFILE = Object.freeze({
  lifetime: 120,
  rechargeAfterExpiry: 40,
  targetAcquisitionDelay: 0.16,
  postCommandRecovery: 0.56,
  subsequentCommandRecovery: 0.08,
  basePower: 1000,
  basePrecision: 1000,
  baseFerocity: 0,
  fireball: Object.freeze({
    skillId: ID.FIRE_ELEMENTAL_FIREBALL,
    // Greater Fire Elemental Fireball starts at 830 before inherited Might and outgoing modifiers.
    baseDamage: 830,
    impact: 1.2,
    animationEnd: 2,
    recovery: 3.2
  }),
  flameBurst: Object.freeze({
    skillId: ID.FIRE_ELEMENTAL_FLAME_BURST,
    // Flame Burst starts near 1,150 before inherited Might and outgoing modifiers.
    baseDamage: 1150,
    impact: 2.52,
    animationEnd: 3.68,
    recovery: 4.64,
    cooldown: 15,
    burningStacks: 1,
    burningDuration: 3,
    mightStacks: 3,
    mightDuration: 10
  }),
  flameBarrage: Object.freeze({
    skillId: ID.FLAME_BARRAGE_ELEMENTAL_COMMAND,
    // All four strike packets share a fixed elemental damage scale instead of player Power or Might.
    damagePerCoefficient: 2500,
    projectileCoefficient: 0.15,
    explosionCoefficient: 1.8,
    projectileImpacts: Object.freeze([1.12, 1.32, 1.52]),
    explosionImpact: 1.52,
    animationEnd: 3.04,
    cooldown: 15,
    burningStacks: 3,
    burningDuration: 3
  })
});

/** Earth Elemental timings and packets measured from the supplied 2026-07-18 ArcDPS log. */
export const EARTH_ELEMENTAL_EVTC_PROFILE = Object.freeze({
  lifetime: 120,
  rechargeAfterExpiry: 40,
  targetAcquisitionDelay: 0.16,
  postCommandRecovery: 0.56,
  subsequentCommandRecovery: 0.08,
  basePower: 1000,
  basePrecision: 1000,
  baseFerocity: 0,
  punch: Object.freeze({
    skillId: ID.EARTH_ELEMENTAL_PUNCH,
    baseDamage: 600,
    impact: 0.36,
    animationEnd: 1,
    recovery: 2.3
  }),
  enervatingPunch: Object.freeze({
    skillId: ID.EARTH_ELEMENTAL_ENERVATING_PUNCH,
    baseDamage: 1200,
    impact: 0.52,
    animationEnd: 1.52,
    recovery: 2.6,
    cooldown: 8,
    weaknessDuration: 3
  }),
  stomp: Object.freeze({
    skillId: ID.STOMP_ELEMENTAL_COMMAND,
    baseDamage: 1500,
    impact: 1.56,
    animationEnd: 3.52,
    cooldown: 18,
    protectionDuration: 3,
    crippleDuration: 5,
    immobilizeDuration: 1
  })
});
