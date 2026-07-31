import { NECROMANCER_SKILL_IDS as ID } from "../../data/ids.js";

export const RITUALIST_MECHANICS = Object.freeze({
  explosiveGrowthCoefficient: 1.2,
  spirits: Object.freeze({
    [ID.ANGUISH]: Object.freeze({
      key: "anguish",
      attackCoefficient: 0.4,
      summonCoefficient: 3.5,
      summonHits: 7,
      // The live barrage packet does not use the spirit autoattack's 1000
      // weapon strength. The supplied EVTC resolves it at ~805 instead.
      summonWeaponStrength: 805,
      summonDelay: 0.68,
      summonInterval: 0.067,
      activeCoefficient: 2.5,
      activeHits: 4,
      activeDelay: 0.36,
      activeInterval: 0.32,
      activeDuration: 2,
    }),
    [ID.WANDERLUST]: Object.freeze({
      key: "wanderlust",
      attackCoefficient: 0.4,
      summonCoefficient: 1,
      // Live PvE packets resolve at 0.45 per pulse (1.8 over four pulses).
      lingeringCoefficient: 1.8,
      lingeringHits: 4,
      lingeringInterval: 1,
      lingeringDelay: 1.877,
      activeCoefficient: 3.7,
      activeHits: 1,
      activeDelay: 0.84,
      activeInterval: 0,
      activeDuration: 1.8,
    }),
    [ID.PRESERVATION]: Object.freeze({
      key: "preservation",
      // The spirit itself has a damaging autoattack even though Preservation's
      // summon and active effects are support-only.
      attackCoefficient: 0.3,
      summonCoefficient: 0,
      activeCoefficient: 0,
      activeHits: 0,
      activeDelay: 0,
      activeInterval: 0,
      activeDuration: 0,
    }),
  }),
  spiritAttackInterval: 4,
  firstSpiritAttackDelay: 7.36,
  summonSpiritsWeaponStrength: 1056,
  essenceBlast: Object.freeze({
    coefficient: 0.75,
    damagePerSpirit: 0.15,
  }),
  painfulBond: Object.freeze({
    duration: 10,
    interval: 1,
    firstPulseDelay: 0.004,
    flatStrikeBase: 200,
    flatStrikePowerCoeff: 0.4,
    icon:
      "https://render.guildwars2.com/file/9CA8D4479BEE9A28C810CCB0E234BAC7712104A0/3680170.png",
  }),
  innervateAnguish: Object.freeze({ coefficient: 1.3 }),
  weaponSpells: Object.freeze({
    nightmare: Object.freeze({
      duration: 10,
      playerStacks: 5,
      allyStacks: 3,
      maxAllies: 4,
      flatStrikeBase: 1200,
      flatStrikePowerCoeff: 0.05,
      vulnerabilityStacks: 2,
      vulnerabilityDuration: 8,
    }),
    splinter: Object.freeze({
      duration: 10,
      playerStacks: 5,
      allyStacks: 3,
      maxAllies: 4,
      coefficient: 0.4,
      internalCooldown: 0.25,
    }),
    resilient: Object.freeze({
      duration: 10,
      playerStacks: 5,
      allyStacks: 3,
      maxAllies: 4,
    }),
  }),
});
