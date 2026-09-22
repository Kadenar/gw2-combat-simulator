/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

export const WARRIOR_WEAPONS_HAMMER_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.HAMMER_SWING]: {
    castTimeMs: 480,
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
    castTimeMs: 480,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.5,
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
        controlKind: 'knockback'
      }
    ])
  },
  [ID.HAMMER_BASH]: {
    castTimeMs: 640,
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
    castTimeMs: 440,
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
    castTimeMs: 880,
    // Custom: Upgrades the strike against controlled or defiant targets; see `core/execution/index.ts`.
    handlerId: 'warrior.fierce-blow',
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 600, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.8
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 4
      }
    ])
  },
  [ID.HAMMER_SHOCK]: {
    cooldown: 8,
    castTimeMs: 600,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 320, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.8
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 7
      }
    ])
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
    castTimeMs: 880,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 680, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 2.25
      },
      {
        type: 'control',
        controlKind: 'knockdown'
      }
    ])
  }
});
