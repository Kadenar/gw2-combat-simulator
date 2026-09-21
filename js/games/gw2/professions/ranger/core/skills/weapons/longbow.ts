/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const RANGER_CORE_LONGBOW_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.BARRAGE]: {
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [1440, 1920, 2400, 2880, 3480, 4080, 4680, 5280, 5880, 6480, 7080, 7680].map((atMs) => ({
          atMs,
          coefficient: 0.5
        }))
      },
      {
        type: 'condition',
        ticks: [1440, 1920, 2400, 2880, 3480, 4080, 4680, 5280, 5880, 6480, 7080, 7680].map((atMs) => ({
          atMs,
          condition: 'Crippled',
          stacks: 1,
          duration: 1
        }))
      }
    ]),
    castTimeMs: 1880
  },
  [ID.RAPID_FIRE]: {
    interruptMode: 'per-packet',
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [360, 520, 680, 840, 1000, 1160, 1320, 1480, 1640, 1800].map((atMs) => ({ atMs, coefficient: 0.6 })),
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
        ticks: [360, 520, 680, 840, 1000, 1160, 1320, 1480, 1640, 1800].map((atMs) => ({
          atMs,
          condition: 'Vulnerability',
          stacks: 1,
          duration: 10
        }))
      }
    ]),
    castTimeMs: 1800,
    missileHits: 10
  },
  [ID.LONG_RANGE_SHOT]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    effects: [
      {
        type: 'strike',
        coefficient: 1.33,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: 'Projectile',
            chance: 0.2,
            ambiguousFieldSelection: 'oldest'
          }
        ]
      }
    ],
    castTimeMs: 480,
    missileHits: 1
  },
  [ID.POINT_BLANK_SHOT]: {
    effects: [
      {
        type: 'strike',
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
        type: 'control',
        controlKind: 'knockback'
      }
    ],
    castTimeMs: 360,
    missileHits: 1
  },
  [ID.HUNTERS_SHOT]: {
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
        type: 'buff',
        kind: 'stealth',
        duration: 3,
        stacks: 1
      }
    ],
    castTimeMs: 320,
    missileHits: 1
  }
});
