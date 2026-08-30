/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/content/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const GUARDIAN_WEAPONS_HAMMER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.BANISH]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1
      },
      {
        type: 'control',
        metadata: {
          controlKind: 'control'
        }
      }
    ]
  },
  [ID.HAMMER_SWING]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1
      }
    ]
  },
  [ID.HAMMER_BASH]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1
      }
    ]
  },
  [ID.SYMBOL_OF_PROTECTION]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Symbol of Protection — Hammer Damage'
      },
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 3,
        name: 'Symbol of Protection — Symbol Damage'
      }
    ]
  },
  [ID.MIGHTY_BLOW]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: 'strike',
        coefficient: 2.4,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'guardian',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      }
    ]
  },
  [ID.RING_OF_WARDING]: {
    implemented: true,
    castTimeMs: 750,
    effects: []
  },
  [ID.ZEALOTS_EMBRACE]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: 'strike',
        coefficient: 2.25,
        hits: 1
      }
    ]
  },
  [ID.GLACIAL_BLOW]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'guardian',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 2.5
      }
    ]
  }
});
