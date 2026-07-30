/**
 * Formula/configuration data consumed by Necromancer-specific handlers.
 *
 * These profiles are deliberately separate from skill-mechanics.js because
 * they describe triggered effects, traits, summons, and profession state
 * machines rather than the shared declarative skill contract.
 */
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../data/ids.js";

export const NECROMANCER_HANDLER_MECHANICS = Object.freeze({
  soulShards: Object.freeze({
    flatStrikeBase: 1504,
    flatStrikePowerCoeff: 0.1,
    flatStrikeHealthThreshold: 0.5,
    flatStrikeThresholdMultiplier: 1.5,
    noCrit: true,
    damageKind: "life-steal",
  }),
  graspingDarkness: Object.freeze({
    baseCommitAtMs: 180,
    lifeForceOnHit: 10,
  }),
  nightfall: Object.freeze({
    lifeForcePerPulse: 7,
  }),
  signetOfVampirism: Object.freeze({
    passive: Object.freeze({
      interval: 3,
      flatStrikeBase: 129,
      flatStrikePowerCoeff: 0.03,
    }),
    active: Object.freeze({
      hits: 6,
      interval: 1,
      flatStrikeBase: 163,
      flatStrikePowerCoeff: 0.05,
    }),
  }),
  traitStrikeCoefficient: Object.freeze({
    [TRAIT.SPITEFUL_SPIRIT]: 1,
    [TRAIT.EXPLOSIVE_GROWTH]: 1.2,
    [TRAIT.CASCADING_CORRUPTION]: 4.5,
  }),
  traitProcs: Object.freeze({
    [TRAIT.DHUUMFIRE]: Object.freeze({
      name: "Dhuumfire",
      traitId: TRAIT.DHUUMFIRE,
      condition: "Burning",
      duration: 3,
      scourgeDuration: 2,
      harbingerDuration: 1,
      scourgeInterval: 1,
    }),
    [TRAIT.UNYIELDING_BLAST]: Object.freeze({
      name: "Unyielding Blast",
      traitId: TRAIT.UNYIELDING_BLAST,
      stacks: 2,
      duration: 10,
    }),
    [TRAIT.SEPTIC_CORRUPTION]: Object.freeze({
      name: "Septic Corruption",
      traitId: TRAIT.SEPTIC_CORRUPTION,
      condition: "Poisoned",
      duration: 3,
    }),
    [TRAIT.BARBED_PRECISION]: Object.freeze({
      name: "Barbed Precision",
      traitId: TRAIT.BARBED_PRECISION,
      condition: "Bleeding",
      duration: 3,
      chanceOnCriticalHit: 0.33,
    }),
    [TRAIT.VAMPIRIC_PRESENCE]: Object.freeze({
      name: "Vampiric Presence",
      traitId: TRAIT.VAMPIRIC_PRESENCE,
      flatStrikeBase: 80,
      flatStrikePowerCoeff: 0.03,
      interval: 1,
    }),
    [TRAIT.DEMONIC_LORE]: Object.freeze({
      name: "Demonic Lore",
      traitId: TRAIT.DEMONIC_LORE,
      condition: "Burning",
      duration: 1,
      interval: 3,
    }),
    [TRAIT.DEATHLY_CHILL]: Object.freeze({
      name: "Deathly Chill",
      traitId: TRAIT.DEATHLY_CHILL,
      condition: "Bleeding",
      stacks: 4,
      duration: 4,
    }),
    [TRAIT.CHILLING_DARKNESS]: Object.freeze({
      name: "Chilling Darkness",
      traitId: TRAIT.CHILLING_DARKNESS,
      condition: "Chilled",
      duration: 2,
    }),
    [TRAIT.INSIDIOUS_DISRUPTION]: Object.freeze({
      name: "Insidious Disruption",
      traitId: TRAIT.INSIDIOUS_DISRUPTION,
      condition: "Torment",
      duration: 8,
    }),
  }),
  minions: Object.freeze({
    [ID.SUMMON_BLOOD_FIEND]: Object.freeze({
      key: "blood-fiend",
      count: 1,
      coefficient: 0.065,
      interval: 3.1,
      commandId: ID.TASTE_OF_DEATH,
    }),
    [ID.SUMMON_BONE_FIEND]: Object.freeze({
      key: "bone-fiend",
      count: 1,
      coefficient: 0.4,
      interval: 2.4,
      commandId: ID.RIGOR_MORTIS,
    }),
    [ID.SUMMON_BONE_MINIONS]: Object.freeze({
      key: "bone-minion",
      count: 2,
      coefficient: 0.04,
      interval: 3.52,
      commandId: ID.PUTRID_EXPLOSION,
    }),
    [ID.SUMMON_SHADOW_FIEND]: Object.freeze({
      key: "shadow-fiend",
      count: 1,
      // Slash and Haunt use the same Shadow Fiend attribute profile. The
      // 1,750 value is the coefficient-normalized PvE skill fact shared by
      // Slash (525 / 0.3) and Haunt (700 / 0.4).
      basePower: 1700,
      damagePerCoefficient: 1750,
      criticalChance: 0.05,
      criticalDamage: 1.5,
      interval: 1.76,
      commandRecoveryDelay: 3.58,
      attacks: Object.freeze([
        Object.freeze({
          skillId: 3642,
          name: "Slash",
          coefficient: 0.3,
        }),
      ]),
      commandId: ID.HAUNT,
    }),
    [ID.SUMMON_FLESH_GOLEM]: Object.freeze({
      key: "flesh-golem",
      count: 1,
      weaponStrength: 900,
      initialDelay: 2.2,
      interval: 4,
      attacks: Object.freeze([
        Object.freeze({
          skillId: 3653,
          name: "Slash",
          icon:
            "https://wiki.guildwars2.com/wiki/Special:FilePath/Fist.png",
          coefficient: 0.18,
          offset: 0,
        }),
        Object.freeze({
          skillId: 3654,
          name: "Slash",
          icon:
            "https://wiki.guildwars2.com/wiki/Special:FilePath/Fist.png",
          coefficient: 0.18,
          offset: 1.28,
        }),
        Object.freeze({
          skillId: 3655,
          name: "Fist",
          icon:
            "https://wiki.guildwars2.com/wiki/Special:FilePath/Fist.png",
          coefficient: 0.29,
          weaponStrength: 931,
          offset: 2.56,
        }),
      ]),
      commandId: ID.CHARGE,
    }),
  }),
  minionCommands: Object.freeze({
    [ID.RIGOR_MORTIS]: Object.freeze({
      minion: "bone-fiend",
      coefficient: 0.5,
      control: "immobilize",
    }),
    [ID.PUTRID_EXPLOSION]: Object.freeze({
      minion: "bone-minion",
      coefficient: 1,
      condition: Object.freeze(["Poisoned", 1, 5]),
      consumes: 1,
    }),
    [ID.TASTE_OF_DEATH]: Object.freeze({
      minion: "blood-fiend",
      coefficient: 0,
      consumes: 1,
    }),
    [ID.HAUNT]: Object.freeze({
      minion: "shadow-fiend",
      coefficient: 0.4,
      control: "blind",
      blindDuration: 5,
      conditions: Object.freeze([
        Object.freeze(["Chilled", 1, 3]),
        Object.freeze(["Weakness", 1, 5]),
      ]),
      impactDelay: 2,
      lifeForceGain: 10,
    }),
    [ID.CHARGE]: Object.freeze({
      minion: "flesh-golem",
      coefficient: 1.5,
      control: "knockdown",
    }),
  }),
  shade: Object.freeze({
    manifest: Object.freeze({
      coefficient: 0.666,
      condition: Object.freeze(["Torment", 1, 2]),
      duration: 15,
      sandSavantDuration: 8,
    }),
    abrasiveGrit: Object.freeze({
      mightDuration: 6,
      mightStacks: 2,
    }),
    desertEmpowerment: Object.freeze({
      alacrityDuration: 1.5,
    }),
    sadisticSearing: Object.freeze({
      condition: Object.freeze(["Burning", 1, 4]),
    }),
    garishPillar: Object.freeze({ fearDuration: 1 }),
    desertShroud: Object.freeze({
      coefficient: 3.15,
      hits: 7,
      interval: 1,
      condition: Object.freeze(["Torment", 1, 5]),
    }),
    sandstormShroud: Object.freeze({
      coefficient: 3,
      delay: 3.5,
      condition: Object.freeze(["Torment", 6, 5]),
      pulseCount: 3,
      pulseInterval: 1,
      pulseProtectionDuration: 1.5,
      detonationProtectionDuration: 3,
    }),
  }),
  elixirs: Object.freeze({
    coefficientBySkillId: Object.freeze({
      [ID.ELIXIR_OF_PROMISE]: 0.8,
      [ID.ELIXIR_OF_RISK]: 2,
      [ID.ELIXIR_OF_BLISS]: 0.8,
      [ID.ELIXIR_OF_IGNORANCE]: 0.8,
      [ID.ELIXIR_OF_ANGUISH]: 1,
      [ID.ELIXIR_OF_AMBITION]: 1.5,
    }),
    empoweredCoefficientMultiplier: 2,
    durationMultiplier: 2,
    conditionBySkillId: Object.freeze({
      [ID.ELIXIR_OF_PROMISE]: Object.freeze(["Poisoned", 3, 5]),
      [ID.ELIXIR_OF_RISK]: Object.freeze(["Torment", 3, 5]),
    }),
    ambitionConditions: Object.freeze([
      "Bleeding",
      "Burning",
      "Confusion",
      "Poisoned",
      "Torment",
    ]),
    ambitionConditionStacks: 3,
    ambitionConditionDuration: 5,
  }),
  blightSkills: Object.freeze({
    [ID.DEVOURING_CUT]: Object.freeze({
      coefficient: 1,
      empoweredCoefficient: 2,
      empoweredCondition: Object.freeze(["Torment", 5, 5]),
    }),
    [ID.VORACIOUS_ARC]: Object.freeze({
      coefficient: 1.4,
      empoweredCoefficient: 2.8,
      empoweredCondition: Object.freeze(["Torment", 5, 7]),
    }),
  }),
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
  // Summon packets use their own calibrated baselines. This keeps player-only
  // attribute effects, such as Signet of Spite, from being baked into them.
  summonWeaponStrength: 1048,
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
  summonMadness: Object.freeze({
    summons: 8,
    summonInterval: 1,
    attack: Object.freeze({ coefficient: 0.33, delay: 1 }),
    explosion: Object.freeze({ coefficient: 1.25, delay: 6 }),
  }),
});
