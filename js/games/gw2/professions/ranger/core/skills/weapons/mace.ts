/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const RANGER_CORE_MACE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.WILD_STRIKES]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.85,
        hits: 1
      },
      {
        type: 'strike',
        coefficient: 1.7,
        hits: 1,
        name: 'Wild Strikes - Final Slam Damage'
      }
    ],
    quicknessCastTimeMs: 1167
  },
  [ID.CULTIVATE]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'vigor',
        duration: 3,
        stacks: 1
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 2
      }
    ],
    quicknessCastTimeMs: 500
  },
  [ID.THISTLEGUARD]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 1,
        stacks: 1
      }
    ],
    quicknessCastTimeMs: 333
  },
  [ID.OAKEN_CUDGEL]: {
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 4,
        stacks: 1
      }
    ],
    quicknessCastTimeMs: 500
  },
  [ID.FLOURISH]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.85,
        hits: 1,
        name: 'Flourish - Initial Damage'
      },
      {
        type: 'strike',
        coefficient: 1.275,
        hits: 1,
        name: 'Flourish - Delayed Damage'
      },
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 4,
        stacks: 1
      }
    ],
    quicknessCastTimeMs: 500
  },
  [ID.BURGEON]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 1
      }
    ],
    quicknessCastTimeMs: 333
  },
  [ID.GERMINATE]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 1
      }
    ],
    quicknessCastTimeMs: 333
  }
});
