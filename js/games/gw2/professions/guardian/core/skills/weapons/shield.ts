/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const GUARDIAN_WEAPONS_SHIELD_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SHIELD_OF_JUDGMENT]: {
    castTimeMs: 750,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      }
    ]
  },
  [ID.SHIELD_OF_ABSORPTION]: {
    castTimeMs: 750,
    effects: []
  },
  [ID.SHIELD_OF_ABSORPTION_ID_9224]: {
    castTimeMs: 750,
    effects: []
  },
  [ID.SHIELD_OF_JUDGMENT_ID_15834]: {
    castTimeMs: 750,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      }
    ]
  }
});
