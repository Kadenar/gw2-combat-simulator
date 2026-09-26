/** Canonical Core engineer skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

/** Defines non-Holosmith Engineer sword timing, damage, conditions, boons, and combo behavior. */
export const ENGINEER_WEAPONS_SWORD_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.RADIANT_ARC_ID_69565]: {
    castTimeMs: 840,
    cooldown: 14,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Leap',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        name: 'Radiant Arc (non-holosmith)',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'quickness',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.SUN_RIPPER_ID_69906]: {
    castTimeMs: 480,
    cooldown: 0,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.02,
        hits: 1,
        name: 'Sun Ripper (non-holosmith)',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 10,
        actorType: 'player'
      }
    ])
  },
  [ID.SUN_EDGE_ID_70514]: {
    castTimeMs: 440,
    cooldown: 0,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.96,
        hits: 1,
        name: 'Sun Edge (non-holosmith)',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 10,
        actorType: 'player'
      }
    ])
  },
  [ID.GLEAM_SABER_ID_70771]: {
    // Custom: Recharges the other sword skills after the cast; see `core/live.ts`.

    castTimeMs: 720,
    // Commit the strike and recharge at 600 ms while retaining the full cast lockout.
    interruptCommitMs: 600,
    retainsCastLockoutAfterInterrupt: true,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 600, coefficient: 1.65 }],
        name: 'Gleam Saber (non-holosmith)',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  },
  [ID.REFRACTION_CUTTER_NON_HOLOSMITH]: {
    castTimeMs: 520,
    cooldown: 6,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1,
        name: 'Refraction Cutter (non-holosmith) — Packet 1',
        actorType: 'player'
      },
      ...impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
        {
          type: 'strike',
          ticks: [40, 80].map((atMs) => ({ atMs, coefficient: 0.8 / 2 })),
          name: 'Refraction Cutter Blade',
          // Report projectile damage separately while retaining the parent sword cast.
          damageBreakdownName: 'Refraction Cutter Blade',
          sourceId: ID.REFRACTION_CUTTER_BLADE,
          actorType: 'player',
          comboFinishers: [
            {
              ownerId: 'engineer',
              finisherType: 'Projectile',
              preferredFieldTypes: ['Fire'],
              ambiguousFieldSelection: 'oldest'
            }
          ],
          projectile: true
        },
        {
          type: 'condition',
          ticks: [40, 80].map((atMs) => ({ atMs, condition: 'Bleeding', stacks: 1, duration: 4 })),
          actorType: 'player'
        }
      ])
    ]
  }
});
