/** Owns mantra identities for flip assembly, preparation, shared charges, and final-charge traits. */
import type { SkillFlips } from '#gw2/platform/skills/skill-flip-definitions.js';
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
    rootId: ID.MANTRA_OF_TRUTH,
    normalId: ID.ECHO_OF_TRUTH,
    finalId: ID.VOICE_OF_TRUTH
  },
  {
    rootId: ID.MANTRA_OF_LIBERATION,
    normalId: ID.PORTENT_OF_FREEDOM,
    finalId: ID.UNHINDERED_DELIVERY
  }
]);

export const GUARDIAN_FIREBRAND_SKILL_FLIPS: SkillFlips = Object.freeze(
  MANTRAS.flatMap(({ rootId, normalId, finalId }) => [
    { parentId: rootId, followUpId: normalId },
    { parentId: normalId, followUpId: finalId }
  ])
);
