/**
 * Owns Holosmith sword skill fragments and heat-aware sword variants.
 * Sword cast behavior shared with Core lives in `core/execution/sword.ts`.
 */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { HolosmithSkillFragment } from '#gw2/professions/engineer/specializations/holosmith/types.js';

/** Supplies Holosmith sword fragments to Holosmith module composition. */
export const HOLOSMITH_SWORD_SKILL_MECHANICS: Readonly<Record<string, HolosmithSkillFragment>> = Object.freeze({
  // Holosmith owns the original sword IDs; Core owns the non-heat Weaponmaster variants.
  [ID.RADIANT_ARC]: {
    castTimeMs: 840,
    cooldown: 12,
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
        name: 'Radiant Arc',
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
        type: 'custom',
        eventType: 'engineer.radiant-arc-quickness',
        event: {
          name: 'Radiant Arc - quickness'
        },
        actorType: 'player'
      }
    ]
  },
  [ID.SUN_EDGE]: {
    castTimeMs: 440,
    cooldown: 0,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.88,
        hits: 1,
        name: 'Sun Edge',
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
  [ID.REFRACTION_CUTTER]: {
    castTimeMs: 520,
    // Preserve committed swing/blade damage and keep the parent cast's lockout before the next input.
    interruptCommitMs: 360,
    retainsCastLockoutAfterInterrupt: true,
    cooldown: 6,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 1.4 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Refraction Cutter - Packet 1',
        actorType: 'player'
      },
      // Share one impact timing while preserving independent payloads and declaration order.
      ...impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 0.4,
          hits: 1,
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
          condition: 'Bleeding',
          stacks: 1,
          duration: 4,
          actorType: 'player'
        }
      ]),
      {
        type: 'custom',
        eventType: 'engineer.refraction-cutter-extra-blades',
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        event: {
          name: 'Refraction Cutter extra blades'
        },
        actorType: 'player'
      }
    ]
  },
  [ID.REFRACTION_CUTTER_BLADE]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1,
        name: 'Refraction Cutter Blade',
        damageBreakdownName: 'Refraction Cutter Blade',
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
        condition: 'Bleeding',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ]
  },
  [ID.SUN_RIPPER]: {
    castTimeMs: 480,
    // The EVTC's successful 441 ms cast must advance the sword chain after replay timing rounds to 440 ms.
    interruptCommitMs: 440,
    cooldown: 0,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.93,
        hits: 1,
        name: 'Sun Ripper',
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
  [ID.GLEAM_SABER]: {
    // Custom: Recharges the other sword skills after the cast; see `core/execution/sword.ts`.
    handlerId: 'engineer.gleam-saber',
    castTimeMs: 720,
    // Commit the strike and recharge at 600 ms while retaining the full cast lockout.
    interruptCommitMs: 600,
    retainsCastLockoutAfterInterrupt: true,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 600, coefficient: 1.5 }],
        name: 'Gleam Saber',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  }
});
