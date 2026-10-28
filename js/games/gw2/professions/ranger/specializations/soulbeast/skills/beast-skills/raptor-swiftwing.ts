/**
 * Owns Soulbeast merged-pet skill fragments for the Raptor Swiftwing family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { CONDITION } from '#gw2/platform/constants.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const SOULBEAST_RAPTOR_SWIFTWING_BEAST_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze(
  {
    [ID.LEAPING_LIZARD]: {
      castTimeMs: 0,
      effects: [
        {
          type: 'strike',
          coefficient: 2,
          hits: 1
        },
        {
          type: 'condition',
          condition: CONDITION.CRIPPLED,
          stacks: 1,
          duration: 4
        }
      ]
    },
    [ID.SAURIAN_MIGHT]: {
      castTimeMs: 0,
      effects: [
        {
          type: 'strike',
          coefficient: 2,
          hits: 1
        },
        {
          type: 'condition',
          condition: CONDITION.BLEEDING,
          stacks: 4,
          duration: 8
        }
      ]
    }
  }
);
