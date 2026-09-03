/**
 * Owns Soulbeast merged-pet skill fragments for the Spinegazer family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const SOULBEAST_SPINEGAZER_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.TORMENTING_VISIONS]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 4,
        atMs: 0
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 8,
        duration: 6
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 4,
        duration: 6
      }
    ]
  },
  [ID.STARING_VOID]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 6,
        duration: 6
      }
    ]
  }
});
