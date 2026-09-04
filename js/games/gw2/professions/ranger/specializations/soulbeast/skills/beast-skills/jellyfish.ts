/**
 * Owns Soulbeast merged-pet skill fragments for the Jellyfish family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const SOULBEAST_JELLYFISH_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.DARK_WATER]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.1,
        hits: 1
      }
    ]
  },
  [ID.HEALING_CLOUD]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 3,
        stacks: 6
      }
    ]
  }
});
