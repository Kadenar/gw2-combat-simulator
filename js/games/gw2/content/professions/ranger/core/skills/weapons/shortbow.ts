/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { RANGER_SKILL_IDS as ID } from '#gw2/content/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const RANGER_CORE_SHORTBOW_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.POISON_VOLLEY]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 5
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 5,
        duration: 5
      }
    ],
    quicknessCastTimeMs: 167
  },
  [ID.CROSSFIRE]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 3
      }
    ],
    quicknessCastTimeMs: 333
  },
  [ID.CRIPPLING_SHOT]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 15
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 4
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 1.5
      }
    ],
    quicknessCastTimeMs: 333,
    handlerId: 'ranger.crippling-shot'
  },
  [ID.CONCUSSION_SHOT]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: 'Projectile',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'control',
        metadata: { controlKind: 'daze' }
      }
    ],
    quicknessCastTimeMs: 167
  },
  [ID.QUICK_SHOT]: {
    implemented: true,
    evades: true,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 9,
        stacks: 1
      }
    ],
    quicknessCastTimeMs: 167
  }
});
