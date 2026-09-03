/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const RANGER_CORE_WARHORN_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.HUNTERS_CALL]: {
    effects: [
      {
        type: 'strike',
        coefficient: 2.4,
        hits: 16,
        atMs: 0
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 16,
        duration: 5
      }
    ],
    quicknessCastTimeMs: 667
  },
  [ID.CALL_OF_THE_WILD]: {
    effects: [
      {
        type: 'boon',
        boon: 'fury',
        duration: 12,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 12,
        stacks: 6
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 12,
        stacks: 1
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 5
      }
    ],
    quicknessCastTimeMs: 167
  }
});
