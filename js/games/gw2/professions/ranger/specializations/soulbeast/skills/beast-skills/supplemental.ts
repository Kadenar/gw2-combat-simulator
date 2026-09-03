/**
 * Owns legacy Soulbeast Beast skills without current pet-family membership.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const SOULBEAST_SUPPLEMENTAL_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.WORLDLY_IMPACT_ID_42809]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1.89,
        hits: 1
      }
    ],
    quicknessCastTimeMs: 500
  },
  [ID.UNDEAD_PLAGUE]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.2,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 4
      }
    ]
  },
  [ID.PHASE_POUNCE]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 2,
        atMs: 0
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 5
      }
    ]
  }
});
