/**
 * Virtuoso-owned formulas and mechanic classifications.
 */
import { MESMER_SKILL_IDS as ID } from '../../../data/ids.js';
import type { MesmerPhantasmAttackTiming, MesmerShatter, MesmerTraitDamage } from '../../../types.js';

export const MESMER_VIRTUOSO_PHANTASM_ATTACK_TIMINGS: Readonly<Record<number, Partial<MesmerPhantasmAttackTiming>>> =
  Object.freeze({
    [ID.PHANTASMAL_BERSERKER]: {
      conversionTicks: [
        {
          atMs: 3120
        },
        {
          atMs: 3440
        }
      ]
    }
  });
export const MESMER_VIRTUOSO_TRAIT_DAMAGE: Readonly<Record<string, MesmerTraitDamage>> = Object.freeze({
  'Phantasmal Blade': {
    coefficient: 0.7,
    hits: 1,
    weaponStrength: 2553.5
  }
});
export const MESMER_VIRTUOSO_SHATTERS: Readonly<Record<number, MesmerShatter>> = Object.freeze({
  [ID.BLADETURN_REQUIEM]: {
    slot: 5,
    kind: 'blade-requiem',
    resolver: 'mesmer.virtuoso.bladesong',
    coefficients: [0, 0.5, 1, 1.5, 2, 2.5],
    minimumResource: 1,
    resourceSpendProgress: 1,
    ticks: [{ atMs: 1000 }, { atMs: 2000 }, { atMs: 3000 }, { atMs: 4000 }, { atMs: 5000 }]
  },
  [ID.BLADESONG_DISSONANCE]: {
    slot: 3,
    kind: 'blade-control',
    resolver: 'mesmer.virtuoso.bladesong',
    coefficients: [0, 1, 1, 1, 1, 1],
    minimumResource: 1,
    resourceSpendProgress: 1,
    damageAtMs: 400
  },
  [ID.BLADESONG_SORROW]: {
    slot: 2,
    kind: 'blade-confusion',
    resolver: 'mesmer.virtuoso.bladesong',
    coefficients: [0, 0.42, 0.84, 1.25, 1.67, 2.09],
    minimumResource: 1,
    resourceSpendProgress: 1,
    ticks: [{ atMs: 442 }, { atMs: 517 }, { atMs: 601 }, { atMs: 675 }, { atMs: 675 }]
  },
  [ID.BLADESONG_HARMONY]: {
    slot: 1,
    kind: 'blade-power',
    resolver: 'mesmer.virtuoso.bladesong',
    coefficients: [0, 0.7, 1.4, 2.1, 2.8, 3.5],
    minimumResource: 1,
    resourceSpendProgress: 1,
    ticks: [{ atMs: 50 }, { atMs: 208 }, { atMs: 367 }, { atMs: 534 }, { atMs: 684 }]
  },
  [ID.BLADESONG_DISTORTION]: {
    slot: 4,
    kind: 'blade-defense',
    resolver: 'mesmer.virtuoso.bladesong',
    minimumResource: 1,
    coefficients: [0, 0, 0, 0, 0, 0]
  }
});
export const MESMER_VIRTUOSO_CONTROL_SKILLS: ReadonlySet<number> = new Set<number>([ID.BLADESONG_DISSONANCE]);
export const MESMER_VIRTUOSO_ARISTOCRACY_SKILLS: ReadonlySet<number> = new Set<number>([ID.RAIN_OF_SWORDS]);
