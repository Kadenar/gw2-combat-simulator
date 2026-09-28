/**
 * Virtuoso-owned formulas and mechanic classifications.
 */
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type {
  MesmerPhantasmAttackTiming,
  MesmerTraitDamage
} from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';

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
