/**
 * Owns Soulbeast merged-pet skill fragments for the Smokescale family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const SOULBEAST_SMOKESCALE_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SMOKE_ASSAULT]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1
      },
      {
        type: 'strike',
        coefficient: 0.35,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 6,
        stacks: 1
      }
    ]
  },
  [ID.TAKEDOWN]: {
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
        duration: 3
      }
    ]
  }
});
