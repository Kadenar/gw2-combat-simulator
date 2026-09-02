/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/content/professions/guardian/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const GUARDIAN_WEAPONS_HAMMER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.BANISH]: {
    castTimeMs: 750,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1
      },
      {
        type: 'control',
        controlKind: 'control'
      }
    ]
  },
  [ID.HAMMER_SWING]: {
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
    castTimeMs: 500,
    comboFields: [
      {
        ownerId: 'guardian',
        fieldType: 'Light',
        duration: 2,
        startAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Symbol of Protection — Hammer Damage'
      },
      {
        type: 'strike',
        // The symbol hits on creation and once per second for its two-second lifetime.
        ticks: [0, 1000, 2000].map((atMs) => ({ atMs, coefficient: 0.5 })),
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        name: 'Symbol of Protection — Symbol Damage'
      }
    ]
  },
  [ID.MIGHTY_BLOW]: {
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
    castTimeMs: 750,
    // Ring is represented only by the five-second Light field relevant to combo resolution.
    comboFields: [
      {
        ownerId: 'guardian',
        fieldType: 'Light',
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    effects: []
  },
  [ID.ZEALOTS_EMBRACE]: {
    castTimeMs: 750,
    effects: [
      {
        type: 'strike',
        coefficient: 2.25,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 2
      }
    ]
  },
  [ID.GLACIAL_BLOW]: {
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
