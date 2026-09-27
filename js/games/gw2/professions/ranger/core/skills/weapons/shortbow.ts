/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

// Projectile flags belong to strikes so Mistral and Shrike count impacts independently of combo success.
export const RANGER_CORE_SHORTBOW_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.POISON_VOLLEY]: {
    effects: [
      {
        type: 'strike',
        projectile: true,
        coefficient: 1.5,
        hits: 5,
        atMs: 0
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 5,
        duration: 5
      }
    ],
    castTimeMs: 167
  },
  [ID.CROSSFIRE]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    effects: [
      {
        type: 'strike',
        projectile: true,
        coefficient: 0.5,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: 'Projectile',
            chance: 0.2,
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 3
      }
    ],
    castTimeMs: 333
  },
  [ID.CRIPPLING_SHOT]: {
    effects: [
      {
        type: 'strike',
        projectile: true,
        coefficient: 0.8,
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
    castTimeMs: 333
    // Custom: Arms Blood Thirst charges after the shot; see `core/hooks.ts`.
  },
  [ID.CONCUSSION_SHOT]: {
    effects: [
      {
        type: 'strike',
        projectile: true,
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
        controlKind: 'daze'
      }
    ],
    castTimeMs: 167
  },
  [ID.QUICK_SHOT]: {
    evades: true,
    effects: [
      {
        type: 'strike',
        projectile: true,
        coefficient: 0.5,
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
        type: 'boon',
        boon: 'swiftness',
        duration: 9,
        stacks: 1
      }
    ],
    castTimeMs: 167
  }
});
