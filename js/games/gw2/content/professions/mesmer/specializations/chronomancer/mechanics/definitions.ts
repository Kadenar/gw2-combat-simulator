/**
 * Chronomancer-owned formulas and mechanic classifications.
 */
import { MESMER_SKILL_IDS as ID } from '#gw2/content/professions/mesmer/data/ids.js';
import type {
  MesmerPhantasmAttackTiming,
  MesmerShatter,
  MesmerTraitDamage
} from '#gw2/content/professions/mesmer/types.js';

export const MESMER_CHRONOMANCER_PHANTASM_ATTACK_TIMINGS: Readonly<
  Record<number, Partial<MesmerPhantasmAttackTiming>>
> = Object.freeze({
  [ID.PHANTASMAL_SWORDSMAN]: {
    repeatDamageAtMs: 5920,
    // The Chronophantasma repeat converts at a measured median near 7.04s post-cast.
    repeatSpawnAtMs: 7040,
    repeatDamageTicks: {
      'Phantasm leap': [{ atMs: 4474 }],
      'Phantasm Blurred Frenzy': [
        { atMs: 4960 },
        { atMs: 5002 },
        { atMs: 5277 },
        { atMs: 5319 },
        { atMs: 5559 },
        { atMs: 5602 },
        { atMs: 5876 },
        { atMs: 5920 }
      ]
    }
  },
  [ID.PHANTASMAL_DUELIST]: {
    repeatDamageAtMs: 5380,
    repeatSpawnAtMs: 6010,
    repeatDamageTicks: {
      'Illusion Damage': [
        { atMs: 3972 },
        { atMs: 4173 },
        { atMs: 4372 },
        { atMs: 4571 },
        { atMs: 4771 },
        { atMs: 4973 },
        { atMs: 5171 },
        { atMs: 5380 }
      ]
    }
  },
  [ID.PHANTASMAL_MAGE]: {
    repeatDamageAtMs: 5040,
    repeatSpawnAtMs: 5290
  },
  [ID.PHANTASMAL_WARLOCK]: {
    repeatDamageAtMs: 7243,
    repeatDamageAtMsByEntity: [7085, 7243],
    repeatSpawnAtMs: 8730,
    repeatDamageTicksByEntity: [
      {
        'One warlock': [{ atMs: 5484 }, { atMs: 6280 }, { atMs: 7085 }]
      },
      {
        'One warlock': [{ atMs: 5642 }, { atMs: 6441 }, { atMs: 7243 }]
      }
    ]
  },
  [ID.PHANTASMAL_BERSERKER]: {
    repeatDamageAtMs: 3721,
    repeatDamageAtMsByEntity: [3544, 3721],
    repeatSpawnAtMs: 5370,
    repeatDamageTicksByEntity: [
      {
        'One berserker': [{ atMs: 3186 }, { atMs: 3302 }, { atMs: 3427 }, { atMs: 3544 }]
      },
      {
        'One berserker': [{ atMs: 3362 }, { atMs: 3480 }, { atMs: 3595 }, { atMs: 3721 }]
      }
    ]
  },
  [ID.PHANTASMAL_DISENCHANTER]: {
    repeatDamageAtMs: 3240,
    repeatSpawnAtMs: 3930
  },
  [ID.PHANTASMAL_WARDEN]: {
    repeatDamageAtMs: 12530,
    repeatSpawnAtMs: 14730
  },
  [ID.PHANTASMAL_DEFENDER]: {
    repeatDamageAtMs: 8560,
    repeatSpawnAtMs: 9270
  },
  [ID.ECHO_OF_MEMORY]: {
    repeatDamageAtMs: 2950,
    repeatSpawnAtMs: 3710
  },
  [ID.PHANTASMAL_SHARPSHOOTER]: {
    repeatDamageAtMs: 2600,
    repeatSpawnAtMs: 2600
  },
  [ID.PHANTASMAL_LANCER]: {
    repeatDamageAtMs: 3240,
    repeatSpawnAtMs: 4080
  }
});
export const MESMER_CHRONOMANCER_TRAIT_DAMAGE: Readonly<Record<string, MesmerTraitDamage>> = Object.freeze({
  'Time Bomb': {
    coefficient: 3,
    hits: 1,
    duration: 5,
    damageIncrease: 0.1
  }
});
export const MESMER_CHRONOMANCER_SHATTERS: Readonly<Record<number, MesmerShatter>> = Object.freeze({
  [ID.CONTINUUM_SPLIT]: {
    slot: 5,
    kind: 'continuum',
    resolver: 'mesmer.chronomancer.continuum',
    consumesResources: false,
    resetBySignetOfIllusions: false,
    coefficients: [0, 0, 0, 0]
  },
  [ID.TIME_SINK]: {
    slot: 3,
    kind: 'control',
    resolver: 'mesmer.core.clone-shatter',
    coefficients: [0, 0, 0, 0]
  },
  [ID.REWINDER]: {
    slot: 2,
    kind: 'confusion',
    resolver: 'mesmer.core.clone-shatter',
    coefficients: [0.38, 0.76, 1.14, 1.52],
    rechargeReductionPerSource: 3
  },
  [ID.SPLIT_SECOND]: {
    slot: 1,
    kind: 'power',
    resolver: 'mesmer.core.clone-shatter',
    coefficients: [1.53, 3.07, 3.68, 4.3],
    hitsPerSource: 2,
    strikeIntervalMs: 1000
  }
});
export const MESMER_CHRONOMANCER_CONTROL_SKILLS: ReadonlySet<number> = new Set<number>([ID.GRAVITY_WELL, ID.TIME_SINK]);
