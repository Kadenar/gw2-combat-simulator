/**
 * Owns Soulbeast merged-pet skill fragments for the Warclaw family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { CONDITION } from '#gw2/platform/constants.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

export const SOULBEAST_WARCLAW_BEAST_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.BATTLE_MAUL]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.75,
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
  [ID.BOP]: {
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      }
    ]
  }
});
