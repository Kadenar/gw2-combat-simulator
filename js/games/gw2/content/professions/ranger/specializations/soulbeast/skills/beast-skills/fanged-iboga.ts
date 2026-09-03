/**
 * Owns Soulbeast merged-pet skill fragments for the Fanged Iboga family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/content/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const SOULBEAST_FANGED_IBOGA_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.NARCOTIC_SPORES]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 6,
        atMs: 0
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 6,
        duration: 8
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 6,
        duration: 3
      }
    ]
  },
  [ID.CRIPPLING_ANGUISH]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 3,
        duration: 3
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 2,
        duration: 6
      }
    ]
  }
});
