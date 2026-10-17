import { ACTOR, COMBO_FIELD, COMBO_FINISHER, CONDITION } from '#gw2/platform/constants.js';
/** Canonical Core guardian skill fragments grouped by their GW2 owner. */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const GUARDIAN_WEAPONS_HAMMER_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.BANISH]: {
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        // A landed strike refreshes the hammer leap, including its Glacial Heart replacement; misses grant no reset.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'each',
            do: { type: 'rechargeReset', skillIds: [ID.MIGHTY_BLOW, ID.GLACIAL_BLOW] }
          }
        ],
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
    castTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1
      }
    ]
  },
  [ID.HAMMER_BASH]: {
    castTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1
      }
    ]
  },
  [ID.SYMBOL_OF_PROTECTION]: {
    // Author symbol identity independently of the skill's display text.
    tags: ['symbol'],
    castTimeMs: 520,
    comboFields: [
      {
        ownerId: 'guardian',
        fieldType: COMBO_FIELD.LIGHT,
        duration: 2,
        startAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'strike',
        metadata: { guardianSymbol: true },
        coefficient: 1,
        hits: 1,
        name: 'Symbol of Protection — Hammer Damage'
      },
      {
        type: 'strike',
        metadata: { guardianSymbol: true },
        // The symbol hits on creation and once per second for its two-second lifetime.
        ticks: [0, 1000, 2000].map((atMs) => ({ atMs, coefficient: 0.5 })),
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        name: 'Symbol of Protection — Symbol Damage'
      }
    ]
  },
  [ID.MIGHTY_BLOW]: {
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 2.4,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'guardian',
            finisherType: COMBO_FINISHER.BLAST,
            ambiguousFieldSelection: 'oldest'
          }
        ]
      }
    ]
  },
  [ID.RING_OF_WARDING]: {
    castTimeMs: 520,
    // Ring is represented only by the five-second Light field relevant to combo resolution.
    comboFields: [
      {
        ownerId: 'guardian',
        fieldType: COMBO_FIELD.LIGHT,
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    effects: []
  },
  [ID.ZEALOTS_EMBRACE]: {
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 2.25,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 2
      }
    ]
  },
  [ID.GLACIAL_BLOW]: {
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'guardian',
            finisherType: COMBO_FINISHER.BLAST,
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'condition',
        condition: CONDITION.CHILLED,
        stacks: 1,
        duration: 2.5
      }
    ]
  }
});
