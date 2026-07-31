/**
 * Formula/configuration data consumed by Core Necromancer handlers.
 *
 * Elite modules may import genuinely profession-wide baselines from here, but
 * Core must never import an elite module's mechanics.
 */
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../data/ids.js";

export const NECROMANCER_CORE_MECHANICS = Object.freeze({
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
  spitefulSpiritCoefficient: 1,
  traitProcs: Object.freeze({
    [TRAIT.DHUUMFIRE]: Object.freeze({
      name: "Dhuumfire",
      traitId: TRAIT.DHUUMFIRE,
      condition: "Burning",
      duration: 3,
    }),
    [TRAIT.UNYIELDING_BLAST]: Object.freeze({
      name: "Unyielding Blast",
      traitId: TRAIT.UNYIELDING_BLAST,
      stacks: 2,
      duration: 10,
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
      duration: 5,
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
  // Summon packets use a profession-wide calibrated baseline so player-only
  // attribute effects, such as Signet of Spite, are not baked into them.
  summonWeaponStrength: 1048,
  summonMadness: Object.freeze({
    summons: 8,
    summonInterval: 1,
    attack: Object.freeze({ coefficient: 0.33, delay: 1 }),
    explosion: Object.freeze({ coefficient: 1.25, delay: 6 }),
  }),
});
