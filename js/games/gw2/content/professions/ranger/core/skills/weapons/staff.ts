/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { RANGER_SKILL_IDS as ID } from '#gw2/content/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const RANGER_CORE_STAFF_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SUBLIME_CONVERSION]: {
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 5,
        stacks: 1
      }
    ],
    quicknessCastTimeMs: 333
  },
  [ID.ANCESTRAL_GRACE]: {
    effects: [
      {
        type: 'boon',
        boon: 'protection',
        duration: 3,
        stacks: 1
      }
    ],
    quicknessCastTimeMs: 833
  },
  [ID.VINE_SURGE]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1
      }
    ],
    quicknessCastTimeMs: 500
  },
  [ID.SOLAR_BEAM]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.3,
        hits: 1
      }
    ],
    quicknessCastTimeMs: 833
  },
  [ID.ASTRAL_WISP]: {
    effects: [],
    quicknessCastTimeMs: 333
  }
});
