/** Mace casts and impacts use observed timings rounded to the nearest 40 ms action tick. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const WARRIOR_WEAPONS_MACE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.MACE_SMASH]: {
    castTimeMs: 440,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.MACE_BASH]: {
    castTimeMs: 600,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.PULVERIZE]: {
    castTimeMs: 920,
    effects: [
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 1,
        atMs: 520,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 5,
        atMs: 520,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.TREMOR]: {
    // Tremor refreshes Crushing Blow when its cast completes.
    mechanicTriggers: [
      {
        type: 'warrior.core.reset-crushing-blow',
        timingAnchor: 'castEnd'
      }
    ],
    castTimeMs: 560,
    dualWieldCastTimeMs: 400,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 440, coefficient: 1.25 },
          { atMs: 520, coefficient: 1.25 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        comboFinishers: [
          {
            ownerId: 'warrior',
            finisherType: 'Projectile',
            chance: 1,
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'control',
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: 'knockdown'
      }
    ]
  },
  [ID.POMMEL_BASH]: {
    cooldown: 10,
    castTimeMs: 440,
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1,
        atMs: 200,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        controlKind: 'daze',
        atMs: 200,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.COUNTERBLOW]: {
    // Like Illusionary Counter, the block arms a separate attack and can release its channel early.
    cooldown: 7,
    castTimeMs: 1960,
    defaultInterruptMs: 200,
    interruptCommitMs: 80,
    handlerId: 'warrior.counterblow',
    effects: []
  },
  [ID.CRUSHING_BLOW]: {
    castTimeMs: 560,
    dualWieldCastTimeMs: 400,
    interruptCommitMs: 440,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 440, coefficient: 2.25 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 6,
        stacks: 5,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 440, condition: 'Vulnerability', stacks: 10, duration: 6 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.TACTICAL_BLOW]: {
    castTimeMs: 480,
    adrenalineGain: 5,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 8,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  }
});
