/**
 * Troubadour-owned formulas and mechanic classifications.
 */
import { MESMER_SKILL_IDS as ID } from '../../../data/ids.js';
import type { MesmerInstrument, MesmerTraitDamage } from '../../../types.js';

export const MESMER_TROUBADOUR_TRAIT_DAMAGE: Readonly<Record<string, MesmerTraitDamage>> = Object.freeze({
  Syncopate: {
    coefficient: 0.75,
    hits: 1
  },
  SyncopateDelayedWave: {
    coefficient: 1,
    hits: 1
  }
});
export const MESMER_TROUBADOUR_CONTROL_SKILLS: ReadonlySet<number> = new Set<number>([
  ID.FLUSTERING_FLUTE,
  ID.DEAFENING_DRUM
]);
export const MESMER_TROUBADOUR_INSTRUMENTS: Readonly<Record<number, MesmerInstrument>> = Object.freeze({
  [ID.LIVELY_LUTE]: {
    slot: 1,
    instrument: 'Lute',
    coefficient: 3,
    hits: 3,
    damageAtMs: 435,
    intervalMs: 200
  },
  [ID.FLUSTERING_FLUTE]: {
    slot: 2,
    instrument: 'Flute',
    coefficient: 1,
    hits: 1,
    damageAtMs: 367,
    conditions: [
      {
        name: 'Confusion',
        duration: 4,
        stacks: 3
      }
    ]
  },
  [ID.HARMONIOUS_HARP]: {
    slot: 4,
    instrument: 'Harp',
    coefficient: 0,
    hits: 0
  },
  [ID.HARMONIOUS_HARP_ALTERNATE]: {
    slot: 4,
    instrument: 'Harp',
    coefficient: 0,
    hits: 0
  },
  [ID.DEAFENING_DRUM]: {
    slot: 3,
    instrument: 'Drum',
    coefficient: 2,
    hits: 1,
    damageAtMs: 518
  },
  [ID.LIVELY_LUTE_ALTERNATE]: {
    slot: 1,
    instrument: 'Lute',
    coefficient: 3,
    hits: 3,
    damageAtMs: 435,
    intervalMs: 200
  }
});
