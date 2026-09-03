/**
 * Owns Soulbeast merged-pet skill fragments for the Raptor Swiftwing family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/content/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const SOULBEAST_RAPTOR_SWIFTWING_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.LEAPING_LIZARD]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 4
      }
    ]
  },
  [ID.SAURIAN_MIGHT]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 4,
        duration: 8
      }
    ]
  }
});
