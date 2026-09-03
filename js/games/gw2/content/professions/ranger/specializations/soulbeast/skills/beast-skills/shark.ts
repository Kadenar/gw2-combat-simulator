/**
 * Owns Soulbeast merged-pet skill fragments for the Shark family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/content/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const SOULBEAST_SHARK_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.CHARGING_BITE]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.54,
        hits: 7,
        atMs: 0
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 7,
        duration: 10
      }
    ]
  },
  [ID.FEAR]: {
    castTimeMs: 0,
    effects: []
  }
});
