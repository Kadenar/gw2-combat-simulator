/**
 * Owns Soulbeast merged-pet skill fragments for the Aether Hunter family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/content/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const SOULBEAST_AETHER_HUNTER_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.LEY_LINE_VORTEX]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 2.8,
        hits: 8,
        atMs: 0
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 6
      }
    ]
  },
  [ID.LUNGE]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 5
      }
    ]
  }
});
