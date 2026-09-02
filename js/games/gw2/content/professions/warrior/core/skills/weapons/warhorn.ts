/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/content/professions/warrior/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const WARRIOR_WEAPONS_WARHORN_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.CHARGE]: {
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 20,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'quickness',
        duration: 2,
        stacks: 1
      }
    ]
  },
  [ID.CALL_OF_VALOR]: {
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'boon',
        boon: 'vigor',
        duration: 10,
        stacks: 1
      }
    ]
  }
});
