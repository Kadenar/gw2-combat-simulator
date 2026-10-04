/**
 * Log-derived damage and timing constants for the Glyph of Elementals summons.
 *
 * Packet timings and damage scales feed the elemental subsystem in `runtime.ts`.
 * Lifetimes and post-expiry recharge belong to the patchable balance profiles.
 */
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';

/** Fire Elemental profile */
export const FIRE_ELEMENTAL_EVTC_PROFILE = Object.freeze({
  postCommandRecovery: 0.56,
  subsequentCommandRecovery: 0.08,
  // Provisional effective Power
  basePower: 1580,
  basePrecision: 1000,
  baseFerocity: 0,
  fireball: Object.freeze({
    skillId: ID.FIRE_ELEMENTAL_FIREBALL,
    // Approximate noncritical mean after removing the elemental's own Might from the controlled sample.
    baseDamage: 760,
    impact: 1.08,
    animationEnd: 2,
    recovery: 3.2
  }),
  flameBurst: Object.freeze({
    skillId: ID.FIRE_ELEMENTAL_FLAME_BURST,
    // Flame Burst starts near 1,150 before inherited Might and outgoing modifiers.
    baseDamage: 1150,
    impact: 2.52,
    animationEnd: 3.68,
    // The next autonomous action starts about 4.8 seconds after an uninterrupted Burst begins.
    recovery: 4.8,
    cooldown: 15,
    burningStacks: 1,
    burningDuration: 3,
    mightStacks: 3,
    mightDuration: 10
  }),
  flameBarrage: Object.freeze({
    skillId: ID.FLAME_BARRAGE_ELEMENTAL_COMMAND,
    // Approximate noncritical scale normalized for pet Might; player Power/equipment are not inherited.
    damagePerCoefficient: 2050,
    projectileCoefficient: 0.15,
    explosionCoefficient: 1.8,
    // Short-range projectiles arrive before the separate explosion, each bringing its own Burning stack.
    projectileImpacts: Object.freeze([0.88, 1.08, 1.28]),
    explosionImpact: 1.52,
    animationEnd: 3.04,
    cooldown: 15,
    burningStacks: 1,
    burningDuration: 3
  })
});

/** Earth Elemental timings and packets measured from the supplied 2026-07-18 ArcDPS log. */
export const EARTH_ELEMENTAL_EVTC_PROFILE = Object.freeze({
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
