/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

export const WARRIOR_WEAPONS_SHIELD_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.SHIELD_BASH]: {
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'control',
        controlKind: 'stun'
      }
    ]
  },
  [ID.SHIELD_STANCE]: {
    castTimeMs: 2000,
    effects: []
  }
});
