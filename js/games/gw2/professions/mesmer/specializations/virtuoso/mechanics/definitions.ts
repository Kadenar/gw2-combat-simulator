/**
 * Virtuoso-owned formulas and mechanic classifications.
 */
import type { MesmerPhantasmAttackTiming } from '#gw2/professions/mesmer/core/mechanics/illusions/types.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

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
