/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/content/professions/warrior/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const WARRIOR_WEAPONS_SHIELD_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SHIELD_BASH]: {
    implemented: true,
    quicknessCastTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'control',
        metadata: {
          controlKind: 'stun',
          duration: 2
        }
      }
    ]
  },
  [ID.SHIELD_STANCE]: {
    implemented: true,
    quicknessCastTimeMs: 2000,
    effects: []
  }
});
