import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

/** Stable mantra families shared by catalog flips, preparation, and final-charge traits. */
export interface MantraDefinition {
  readonly rootId: number;
  readonly rootName: string;
  readonly normalId: number;
  readonly finalId: number;
}

export const MANTRAS: readonly MantraDefinition[] = Object.freeze([
  {
    rootId: ID.MANTRA_OF_SOLACE,
    rootName: 'Mantra of Solace',
    normalId: ID.RESTORING_REPRIEVE,
    finalId: ID.REJUVENATING_RESPITE
  },
  {
    rootId: ID.MANTRA_OF_FLAME,
    rootName: 'Mantra of Flame',
    normalId: ID.FLAME_RUSH,
    finalId: ID.FLAME_SURGE
  },
  {
    rootId: ID.MANTRA_OF_POTENCE,
    rootName: 'Mantra of Potence',
    normalId: ID.POTENT_HASTE,
    finalId: ID.OVERWHELMING_CELERITY
  },
  {
    rootId: ID.MANTRA_OF_LIBERATION,
    rootName: 'Mantra of Liberation',
    normalId: ID.PORTENT_OF_FREEDOM,
    finalId: ID.UNHINDERED_DELIVERY
  }
]);
