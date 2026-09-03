/**
 * Owns Soulbeast merged-pet skill fragments for the Rock Gazelle family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/content/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const SOULBEAST_ROCK_GAZELLE_BEAST_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.KICK]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.94,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 3,
        duration: 6
      }
    ]
  },
  [ID.CHARGE]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.565,
        hits: 1,
        name: 'Charge - Travel Damage'
      },
      {
        type: 'strike',
        coefficient: 1.13,
        hits: 1,
        name: 'Charge - Impact Damage'
      }
    ]
  }
});
