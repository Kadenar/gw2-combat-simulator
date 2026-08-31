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
    repeatDamageAtMs: 6000,
    // Chronophantasma packet and final conversion offsets stay anchored to the original cast end.
    repeatSpawnAtMs: 7120,
    repeatDamageTicks: {
      'Phantasm leap': [{ atMs: 4560 }],
      'Phantasm Blurred Frenzy': [
        { atMs: 5040 },
        { atMs: 5080 },
        { atMs: 5360 },
        { atMs: 5400 },
        { atMs: 5640 },
        { atMs: 5680 },
        { atMs: 5960 },
        { atMs: 6000 }
      ]
    }
  },
  [ID.PHANTASMAL_DUELIST]: {
    repeatDamageAtMs: 5260,
    repeatSpawnAtMs: 5800,
    repeatDamageTicks: {
      'Illusion Damage': [
        { atMs: 3860 },
        { atMs: 4060 },
        { atMs: 4260 },
        { atMs: 4460 },
        { atMs: 4660 },
        { atMs: 4860 },
        { atMs: 5060 },
        { atMs: 5260 }
      ]
    }
  },
  [ID.PHANTASMAL_MAGE]: {
    repeatDamageAtMs: 3920,
    repeatSpawnAtMs: 4160
  },
  [ID.PHANTASMAL_WARLOCK]: {
    repeatDamageAtMs: 7200,
    repeatDamageAtMsByEntity: [7160, 7200],
    // The repeated Warlocks preserve their separately observed conversions.
    repeatSpawnAtMs: 8460,
    repeatSpawnAtMsByEntity: [8440, 8480],
    repeatDamageTicksByEntity: [
      {
        'One warlock': [{ atMs: 5560 }, { atMs: 6360 }, { atMs: 7160 }]
      },
      {
        'One warlock': [{ atMs: 5600 }, { atMs: 6400 }, { atMs: 7200 }]
      }
    ]
  },
  [ID.PHANTASMAL_BERSERKER]: {
    repeatDamageAtMs: 3680,
    repeatDamageAtMsByEntity: [3520, 3680],
    repeatSpawnAtMs: 5160,
    // Bountiful Blades retains both measured repeat attacks and clone conversions independently.
    repeatSpawnAtMsByEntity: [5120, 5160],
    repeatDamageTicksByEntity: [
      {
        'One berserker': [{ atMs: 3160 }, { atMs: 3320 }, { atMs: 3400 }, { atMs: 3520 }]
      },
      {
        'One berserker': [{ atMs: 3320 }, { atMs: 3440 }, { atMs: 3560 }, { atMs: 3680 }]
      }
    ]
  },
  [ID.PHANTASMAL_DISENCHANTER]: {
    repeatDamageAtMs: 3230,
    // Keep the repeated phantasm alive through the observed second Continuum Split boundary.
    repeatSpawnAtMs: 4080
  },
  [ID.PHANTASMAL_WARDEN]: {
    repeatDamageAtMs: 12020,
    repeatSpawnAtMs: 14180,
    repeatDamageTicks: {
      Damage: [
        { atMs: 8020 },
        { atMs: 8380 },
        { atMs: 8740 },
        { atMs: 9100 },
        { atMs: 9460 },
        { atMs: 9820 },
        { atMs: 10220 },
        { atMs: 10580 },
        { atMs: 10940 },
        { atMs: 11300 },
        { atMs: 11670 },
        { atMs: 12020 }
      ]
    }
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
    // Clarity Chronophantasma agents can stagger despite spawning together; representative
    // per-entity offsets were repeat damage [3120, 3320] and final conversion [4000, 4160].
    // These are Clarity-only observations and must not replace the single-Lancer profile globally.
    repeatDamageAtMs: 3300,
    repeatSpawnAtMs: 4140
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
