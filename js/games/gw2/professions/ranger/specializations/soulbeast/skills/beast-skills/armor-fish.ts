/**
 * Owns Soulbeast merged-pet skill fragments for the Armor Fish family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const SOULBEAST_ARMOR_FISH_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.PROTECTION]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'boon',
        boon: 'protection',
        duration: 10,
        stacks: 1
      }
    ]
  },
  [ID.CHOMP_ID_44885]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1
      }
    ]
  }
});
