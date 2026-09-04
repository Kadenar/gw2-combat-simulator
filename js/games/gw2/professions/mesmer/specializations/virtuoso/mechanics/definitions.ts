/**
 * Virtuoso-owned formulas and mechanic classifications.
 */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerShatter } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import type {
  MesmerPhantasmAttackTiming,
  MesmerTraitDamage
} from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';

/**
 * Builds each blade tier's timed packets from its total strike coefficient.
 * `coefficients` remains the tier total used by shared shatter profiles, while
 * `ticks` distributes that total across the packets' individual impact times.
 */
function bladePacketTiers(coefficients: readonly number[], atMs: readonly number[]) {
  return coefficients.map((coefficient, spent) =>
    atMs.slice(0, spent).map((packetAtMs) => ({ atMs: packetAtMs, coefficient: coefficient / spent }))
  );
}

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
    ticks: bladePacketTiers([0, 0.5, 1, 1.5, 2, 2.5], [1000, 2000, 3000, 4000, 5000])
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
    ticks: bladePacketTiers([0, 0.42, 0.84, 1.25, 1.67, 2.09], [442, 517, 601, 675, 675])
  },
  [ID.BLADESONG_HARMONY]: {
    slot: 1,
    kind: 'blade-power',
    resolver: 'mesmer.virtuoso.bladesong',
    coefficients: [0, 0.7, 1.4, 2.1, 2.8, 3.5],
    minimumResource: 1,
    resourceSpendProgress: 1,
    ticks: bladePacketTiers([0, 0.7, 1.4, 2.1, 2.8, 3.5], [50, 208, 367, 534, 684])
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
