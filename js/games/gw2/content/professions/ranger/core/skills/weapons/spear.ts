/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { RANGER_SKILL_IDS as ID } from '#gw2/content/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const RANGER_CORE_SPEAR_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.DRAKES_SWIPE]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 1
      }
    ],
    quicknessCastTimeMs: 333
  },
  [ID.FALCONS_STOOP]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.95,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 4
      }
    ],
    quicknessCastTimeMs: 500
  },
  [ID.PANTHERS_PROWL]: {
    implemented: true,
    effects: [
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 6,
        stacks: 1
      }
    ],
    quicknessCastTimeMs: 333
  },
  [ID.WARCLAWS_ENGAGE]: {
    implemented: true,
    evades: true,
    effects: [
      {
        type: 'strike',
        coefficient: 2.75,
        hits: 1
      }
    ],
    quicknessCastTimeMs: 500
  },
  [ID.CHEETAHS_STRIKE]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 3,
        stacks: 1
      }
    ],
    quicknessCastTimeMs: 500
  },
  [ID.MONGOOSES_FRENZY]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 2,
        atMs: 0
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 8,
        duration: 8
      }
    ],
    quicknessCastTimeMs: 667
  },
  [ID.WYVERNS_LASH]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2
      }
    ],
    quicknessCastTimeMs: 333
  }
});
