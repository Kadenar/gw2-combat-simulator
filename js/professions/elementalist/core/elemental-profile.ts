import { ELEMENTALIST_SKILL_IDS as ID } from "../data/ids.js";

/**
 * Fire Elemental timings and packets measured from the supplied 2026-07-16
 * ArcDPS log.
 */
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
    baseDamage: 995,
    impact: 1.2,
    animationEnd: 2,
    recovery: 3.2,
  }),
  flameBurst: Object.freeze({
    skillId: ID.FIRE_ELEMENTAL_FLAME_BURST,
    baseDamage: 1460,
    impact: 2.52,
    animationEnd: 3.68,
    recovery: 4.64,
    cooldown: 15,
    burningStacks: 1,
    burningDuration: 3,
    mightStacks: 3,
    mightDuration: 10,
  }),
  flameBarrage: Object.freeze({
    skillId: ID.FLAME_BARRAGE_ELEMENTAL_COMMAND,
    projectileBaseDamage: 400,
    explosionBaseDamage: 4800,
    projectileImpacts: Object.freeze([1.12, 1.32, 1.52]),
    explosionImpact: 1.52,
    animationEnd: 3.04,
    cooldown: 15,
    burningStacks: 1,
    burningDuration: 3,
  }),
});
