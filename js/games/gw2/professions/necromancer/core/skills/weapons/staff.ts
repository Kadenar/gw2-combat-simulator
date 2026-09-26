/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

export const NECROMANCER_WEAPONS_STAFF_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.NECROTIC_GRASP]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 880,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'necromancer',
            finisherType: 'Projectile',
            chance: 0.2,
            ambiguousFieldSelection: 'oldest'
          }
        ]
      }
    ],
    lifeForceGain: 4
  },
  [ID.CHILLBLAINS]: {
    castTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 2,
        duration: 8
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 4
      }
    ]
  },
  [ID.REAPERS_MARK]: {
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1
      },
      {
        type: 'control',
        controlKind: 'fear'
      }
    ]
  },
  [ID.PUTRID_MARK]: {
    castTimeMs: 480,
    // The handler and tooltip share the maximum number of distinct self-condition types transferred.
    conditionsTransferred: 3,
    effects: [
      {
        type: 'strike',
        coefficient: 1.32,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'necromancer',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      }
    ]
  },
  [ID.MARK_OF_BLOOD]: {
    castTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 8
      }
    ]
  }
});
