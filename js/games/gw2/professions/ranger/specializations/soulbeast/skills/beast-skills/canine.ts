/**
 * Owns Soulbeast merged-pet skill fragments for the Canine family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const SOULBEAST_CANINE_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.BRUTAL_CHARGE]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.64,
        hits: 1
      }
    ]
  },
  [ID.CRIPPLING_LEAP]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.98,
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
