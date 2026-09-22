/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

export const GUARDIAN_WEAPONS_SHIELD_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.SHIELD_OF_JUDGMENT]: {
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      }
    ]
  },
  [ID.SHIELD_OF_ABSORPTION]: {
    castTimeMs: 520,
    effects: []
  },
  [ID.SHIELD_OF_ABSORPTION_ID_9224]: {
    castTimeMs: 520,
    effects: []
  },
  [ID.SHIELD_OF_JUDGMENT_ID_15834]: {
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      }
    ]
  }
});
