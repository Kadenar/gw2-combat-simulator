/**
 * Chronomancer-owned formulas and mechanic classifications.
 */
import { MESMER_SKILL_IDS as ID } from '../../data/ids.js';
import type {
  MesmerAmbushAttack,
  MesmerCloneAttack,
  MesmerInstrument,
  MesmerPhantasmAttackTiming,
  MesmerShatter,
  MesmerTraitDamage
} from '../../types.js';

export const MESMER_CHRONOMANCER_WEAPON_STRENGTH: Readonly<Record<string, number>> = Object.freeze({});
export const MESMER_CHRONOMANCER_CLONE_ATTACKS: Readonly<Record<string, MesmerCloneAttack>> = Object.freeze({});
export const MESMER_CHRONOMANCER_AMBUSH_ATTACKS: Readonly<Record<string, MesmerAmbushAttack>> = Object.freeze({});
export const MESMER_CHRONOMANCER_PHANTASM_ATTACK_TIMINGS: Readonly<
  Record<number, Partial<MesmerPhantasmAttackTiming>>
> = Object.freeze({
  [ID.PHANTASMAL_SWORDSMAN]: {
    chronophantasmaDamageAtMs: 5920,
    chronophantasmaSpawnAtMs: 7450,
    chronophantasmaDamageTicks: {
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
    chronophantasmaDamageAtMs: 5380,
    chronophantasmaSpawnAtMs: 6010,
    chronophantasmaDamageTicks: {
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
    chronophantasmaDamageAtMs: 5040,
    chronophantasmaSpawnAtMs: 5290
  },
  [ID.PHANTASMAL_WARLOCK]: {
    chronophantasmaDamageAtMs: 7243,
    chronophantasmaDamageAtMsByEntity: [7085, 7243],
    chronophantasmaSpawnAtMs: 8730,
    chronophantasmaDamageTicksByEntity: [
      {
        'One warlock': [{ atMs: 5484 }, { atMs: 6280 }, { atMs: 7085 }]
      },
      {
        'One warlock': [{ atMs: 5642 }, { atMs: 6441 }, { atMs: 7243 }]
      }
    ]
  },
  [ID.PHANTASMAL_BERSERKER]: {
    chronophantasmaDamageAtMs: 3721,
    chronophantasmaDamageAtMsByEntity: [3544, 3721],
    chronophantasmaSpawnAtMs: 5370,
    chronophantasmaDamageTicksByEntity: [
      {
        'One berserker': [{ atMs: 3186 }, { atMs: 3302 }, { atMs: 3427 }, { atMs: 3544 }]
      },
      {
        'One berserker': [{ atMs: 3362 }, { atMs: 3480 }, { atMs: 3595 }, { atMs: 3721 }]
      }
    ]
  },
  [ID.PHANTASMAL_DISENCHANTER]: {
    chronophantasmaDamageAtMs: 3240,
    chronophantasmaSpawnAtMs: 3930
  },
  [ID.PHANTASMAL_WARDEN]: {
    chronophantasmaDamageAtMs: 12530,
    chronophantasmaSpawnAtMs: 14730
  },
  [ID.PHANTASMAL_DEFENDER]: {
    chronophantasmaDamageAtMs: 8560,
    chronophantasmaSpawnAtMs: 9270
  },
  [ID.ECHO_OF_MEMORY]: {
    chronophantasmaDamageAtMs: 2950,
    chronophantasmaSpawnAtMs: 3710
  },
  [ID.PHANTASMAL_SHARPSHOOTER]: {
    chronophantasmaDamageAtMs: 2600,
    chronophantasmaSpawnAtMs: 2600
  },
  [ID.PHANTASMAL_LANCER]: {
    chronophantasmaDamageAtMs: 1833.3333333,
    chronophantasmaSpawnAtMs: 1833.3333333
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
    hitsPerSource: 2
  }
});
export const MESMER_CHRONOMANCER_CONTROL_SKILLS: ReadonlySet<number> = new Set<number>([ID.GRAVITY_WELL, ID.TIME_SINK]);
export const MESMER_CHRONOMANCER_BLIND_SKILLS: ReadonlySet<number> = new Set<number>([]);
export const MESMER_CHRONOMANCER_ARISTOCRACY_SKILLS: ReadonlySet<number> = new Set<number>([]);
export const MESMER_CHRONOMANCER_PEITHA_SKILLS: ReadonlySet<number> = new Set<number>([]);
export const MESMER_CHRONOMANCER_INSTRUMENTS: Readonly<Record<number, MesmerInstrument>> = Object.freeze({});
