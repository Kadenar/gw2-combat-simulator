/**
 * Owns Soulbeast merged-pet skill fragments for the Feline family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/content/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const SOULBEAST_FELINE_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.BITE]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.98,
        hits: 1
      }
    ]
  },
  [ID.MAUL_ID_44514]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 2,
        atMs: 0
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 4,
        duration: 10
      }
    ]
  }
});
