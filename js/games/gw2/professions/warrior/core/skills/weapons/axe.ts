/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const WARRIOR_WEAPONS_AXE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.CHOP]: {
    interruptCommitMs: 440,
    castTimeMs: 520,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 240, coefficient: 0.7 }],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.DOUBLE_CHOP]: {
    castTimeMs: 760,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 240, coefficient: 0.45 }],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Double Chop — First Chop Damage'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 560, coefficient: 1.05 }],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Double Chop — Second Chop Damage'
      }
    ]
  },
  [ID.TRIPLE_CHOP]: {
    castTimeMs: 1280,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 280, coefficient: 0.75 },
          { atMs: 600, coefficient: 0.75 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 1000, coefficient: 1.6 }],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Triple Chop — Final chop damage.'
      }
    ]
  },
  [ID.THROW_AXE]: {
    ammo: 2,
    ammoRecharge: 10,
    cooldown: 10,
    ammoCastLockout: 1,
    castTimeMs: 360,
    dualWieldCastTimeMs: 240,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Projectile',
        chance: 1,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 280, coefficient: 0.85, projectile: true }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 4,
        atMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.WHIRLING_AXE]: {
    interruptMode: 'per-packet',
    cooldown: 15,
    castTimeMs: 2720,
    dualWieldCastTimeMs: 2040,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 15 }, (_, index) => ({
          atMs: 320 + index * 160,
          coefficient: 0.5592
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        comboFinishers: [
          {
            ownerId: 'warrior',
            finisherType: 'Whirl',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      }
    ]
  },
  [ID.DUAL_STRIKE]: {
    cooldown: 12,
    castTimeMs: 560,
    dualWieldCastTimeMs: 400,
    effects: [
      {
        type: 'strike',
        coefficient: 2.35,
        hits: 2,
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'quickness',
        duration: 2,
        stacks: 1,
        applications: 2,
        intervalMs: 0,
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.CYCLONE_AXE]: {
    cooldown: 6,
    castTimeMs: 400,
    dualWieldCastTimeMs: 280,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 200, coefficient: 0.88 },
          { atMs: 360, coefficient: 0.88 }
        ],
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
        type: 'boon',
        boon: 'fury',
        duration: 2,
        stacks: 1,
        applications: 2,
        intervalMs: 160,
        atMs: 200,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 3,
        duration: 8,
        applications: 2,
        intervalMs: 160,
        atMs: 200,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  }
});
