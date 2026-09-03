/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const WARRIOR_WEAPONS_HAMMER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.HAMMER_SWING]: {
    quicknessCastTimeMs: 480,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 360, coefficient: 0.9 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.STAGGERING_BLOW]: {
    cooldown: 18,
    quicknessCastTimeMs: 480,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 1.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        comboFinishers: [
          {
            ownerId: 'warrior',
            finisherType: 'Whirl',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'control',
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        controlKind: 'knockback'
      }
    ]
  },
  [ID.HAMMER_BASH]: {
    quicknessCastTimeMs: 640,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 0.9 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.HAMMER_SMASH]: {
    interruptCommitMs: 320,
    quicknessCastTimeMs: 440,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 1.2 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.FIERCE_BLOW]: {
    interruptCommitMs: 600,
    cooldown: 6,
    quicknessCastTimeMs: 880,
    // Custom: Upgrades the strike against controlled or defiant targets; see `core/execution/index.ts`.
    handlerId: 'warrior.fierce-blow',
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 600, coefficient: 1.8 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 600, condition: 'Weakness', stacks: 1, duration: 4 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.HAMMER_SHOCK]: {
    cooldown: 8,
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 1.8 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 320, condition: 'Crippled', stacks: 1, duration: 7 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.BACKBREAKER]: {
    cooldown: 25,
    // Backbreaker refreshes Fierce Blow when its cast completes.
    mechanicTriggers: [
      {
        type: 'warrior.core.reset-fierce-blow',
        timingAnchor: 'castEnd'
      }
    ],
    quicknessCastTimeMs: 880,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 680, coefficient: 2.25 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        atMs: 680,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        controlKind: 'knockdown',
        duration: 3
      }
    ]
  }
});
