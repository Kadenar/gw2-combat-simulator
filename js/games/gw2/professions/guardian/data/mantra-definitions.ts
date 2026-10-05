import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

/** Stable mantra families shared by catalog flips, preparation, and final-charge traits. */
export interface MantraDefinition {
  readonly rootId: number;
  readonly normalId: number;
  readonly finalId: number;
}

export const MANTRAS: readonly MantraDefinition[] = Object.freeze([
  {
    rootId: ID.MANTRA_OF_SOLACE,
    normalId: ID.RESTORING_REPRIEVE,
    finalId: ID.REJUVENATING_RESPITE
  },
  {
    rootId: ID.MANTRA_OF_FLAME,
    normalId: ID.FLAME_RUSH,
    finalId: ID.FLAME_SURGE
  },
  {
    rootId: ID.MANTRA_OF_POTENCE,
    normalId: ID.POTENT_HASTE,
    finalId: ID.OVERWHELMING_CELERITY
  },
  {
    rootId: ID.MANTRA_OF_LIBERATION,
    normalId: ID.PORTENT_OF_FREEDOM,
    finalId: ID.UNHINDERED_DELIVERY
  }
]);
