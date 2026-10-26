import { COMBO_FINISHER, CONTROL, STATUS, CONDITION } from '#gw2/platform/constants.js';
/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

// Projectile flags belong to strikes so Mistral and Shrike count impacts independently of combo success.
export const RANGER_CORE_LONGBOW_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.LONG_RANGE_SHOT]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 480,
    effects: [
      {
        type: 'strike',
        projectile: true,
        coefficient: 1.33,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: COMBO_FINISHER.PROJECTILE,
            chance: 0.2
          }
        ]
      }
    ]
  },
  [ID.RAPID_FIRE]: {
    castTimeMs: 1800,
    interruptMode: 'per-packet',
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        projectile: true,
        ticks: [360, 520, 680, 840, 1000, 1160, 1320, 1480, 1640, 1800].map((atMs) => ({ atMs, coefficient: 0.6 })),
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: COMBO_FINISHER.PROJECTILE,
            chance: 0.2
          }
        ]
      },
      {
        type: 'condition',
        ticks: [360, 520, 680, 840, 1000, 1160, 1320, 1480, 1640, 1800].map((atMs) => ({
          atMs,
          condition: CONDITION.VULNERABILITY,
          stacks: 1,
          duration: 10
        }))
      }
    ])
  },
  [ID.HUNTERS_SHOT]: {
    castTimeMs: 320,
    effects: [
      {
        type: 'strike',
        projectile: true,
        coefficient: 0.4,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: COMBO_FINISHER.PROJECTILE
          }
        ]
      },
      {
        type: 'buff',
        kind: STATUS.STEALTH,
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.POINT_BLANK_SHOT]: {
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        projectile: true,
        coefficient: 0.8,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: COMBO_FINISHER.PROJECTILE
          }
        ]
      },
      {
        type: 'control',
        controlKind: CONTROL.KNOCKBACK
      }
    ]
  },
  [ID.BARRAGE]: {
    castTimeMs: 1880,
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
          condition: CONDITION.CRIPPLED,
          stacks: 1,
          duration: 1
        }))
      }
    ])
  }
});
