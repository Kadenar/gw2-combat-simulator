/**
 * Owns Core Elementalist conjured-bundle weapon skill fragments.
 *
 * The table contains Frost Bow, Lightning Hammer, and Fiery Greatsword packet data only.
 * Equip, pickup, and recharge state lives in `core/mechanics/conjures.ts`.
 */
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { impactEffects, conditionTimeline, strikeTimeline } from '#gw2/platform/engine/effects/factories.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';
import { withSmallHitboxCap } from '#gw2/professions/elementalist/core/skills/hitbox.js';

/**
 * Skill-id → fragment table for the conjured-bundle weapon skills.
 * Entries are keyed by GW2 skill id and overlay the catalog entry of the same id.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const ELEMENTALIST_CONJURE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  // --- Frost Bow (conjure) ---------------------------------------------------
  // `skillWeapon` is the bundle gate: availability blocks these unless the matching conjure is
  // equipped, and blocks normal weapon skills while it is (see core/mechanics/availability.ts).
  [ID.WATER_ARROW]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Water Arrow',
    type: 'Weapon',
    slot: 'Weapon_1',
    skillWeapon: 'Frost Bow',
    categories: ['Weapon skill'],
    castTimeMs: 600,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 560,
            coefficient: 0.3
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.FROST_VOLLEY]: {
    name: 'Frost Volley',
    type: 'Weapon',
    slot: 'Weapon_2',
    skillWeapon: 'Frost Bow',
    categories: ['Weapon skill'],
    castTimeMs: 1600,
    cooldown: 6,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [360, 680, 1000, 1320, 1640].map((atMs) => ({
          atMs,
          coefficient: 0.5,
          comboFinishers: [
            {
              ownerId: 'elementalist',
              finisherType: 'Projectile',
              ambiguousFieldSelection: 'oldest'
            }
          ],
          metadata: {}
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [360, 680, 1000, 1320, 1640].map((atMs) => ({
          atMs,
          condition: 'Vulnerability',
          stacks: 1,
          duration: 15
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  // Fan fires all seven packets (and their Chilled applications) at the same 240ms offset.
  [ID.FROST_FAN]: {
    name: 'Frost Fan',
    type: 'Weapon',
    slot: 'Weapon_3',
    skillWeapon: 'Frost Bow',
    categories: ['Weapon skill'],
    castTimeMs: 560,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        coefficient: 1.75,
        hits: 7,
        atMs: 240,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 240,
            condition: 'Chilled',
            stacks: 1,
            duration: 1
          },
          {
            atMs: 240,
            condition: 'Chilled',
            stacks: 1,
            duration: 1
          },
          {
            atMs: 240,
            condition: 'Chilled',
            stacks: 1,
            duration: 1
          },
          {
            atMs: 240,
            condition: 'Chilled',
            stacks: 1,
            duration: 1
          },
          {
            atMs: 240,
            condition: 'Chilled',
            stacks: 1,
            duration: 1
          },
          {
            atMs: 240,
            condition: 'Chilled',
            stacks: 1,
            duration: 1
          },
          {
            atMs: 240,
            condition: 'Chilled',
            stacks: 1,
            duration: 1
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  // Channelled field: strikes reuse the shared tick timeline, and Bleeding rides every tick
  // except the opening one.
  [ID.FROST_STORM]: withSmallHitboxCap(
    {
      name: 'Frost Storm',
      type: 'Weapon',
      slot: 'Weapon_4',
      skillWeapon: 'Frost Bow',
      categories: ['Weapon skill'],
      castTimeMs: 2360,
      cooldown: 20,
      skillFamily: 'Weapon skill',
      effects: [
        strikeTimeline(
          [
            { atMs: 1040, coefficient: 0.7 },
            { atMs: 1320, coefficient: 0.63 },
            { atMs: 1520, coefficient: 0.56 },
            { atMs: 1560, coefficient: 0.49 },
            { atMs: 1800, coefficient: 0.42 },
            { atMs: 1800, coefficient: 0.35 },
            { atMs: 2000, coefficient: 0.28 },
            { atMs: 2040, coefficient: 0.21 },
            { atMs: 2280, coefficient: 0.14 },
            { atMs: 2280, coefficient: 0.14 },
            { atMs: 2480, coefficient: 0.14 },
            { atMs: 2520, coefficient: 0.14 },
            { atMs: 2760, coefficient: 0.14 },
            { atMs: 2760, coefficient: 0.14 },
            { atMs: 2960, coefficient: 0.14 },
            { atMs: 3000, coefficient: 0.14 },
            { atMs: 3240, coefficient: 0.14 },
            { atMs: 3240, coefficient: 0.14 },
            { atMs: 3480, coefficient: 0.14 },
            { atMs: 3720, coefficient: 0.14 },
            { atMs: 3960, coefficient: 0.14 },
            { atMs: 4240, coefficient: 0.14 },
            { atMs: 4480, coefficient: 0.14 },
            { atMs: 4720, coefficient: 0.14 }
          ],
          { timingAnchor: 'castStart', timingScale: 'cast' }
        ),
        conditionTimeline(
          [
            1320, 1520, 1560, 1800, 1800, 2000, 2040, 2280, 2280, 2480, 2520, 2760, 2760, 2960, 3000, 3240, 3240, 3480,
            3720, 3960, 4240, 4480, 4720
          ].map((atMs) => ({
            atMs,
            condition: 'Bleeding',
            stacks: 1,
            duration: 3
          })),
          { timingAnchor: 'castStart', timingScale: 'cast' }
        )
      ]
    },
    14
  ),
  [ID.DEEP_FREEZE]: {
    name: 'Deep Freeze',
    type: 'Weapon',
    slot: 'Weapon_5',
    skillWeapon: 'Frost Bow',
    categories: ['Weapon skill'],
    castTimeMs: 1120,
    cooldown: 30,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 1120, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.8, canCrit: true },
      { type: 'condition', condition: 'Chilled', stacks: 1, duration: 5, metadata: {} },
      { type: 'control', applications: 1, controlKind: 'crowd-control' }
    ])
  },
  // --- Lightning Hammer (conjure) --------------------------------------------
  // Weapon_1 is a three-step chain wired through `nextChainId`:
  // Lightning Swing → Static Swing → Thunderclap → back to Lightning Swing.
  [ID.LIGHTNING_SWING]: {
    name: 'Lightning Swing',
    type: 'Weapon',
    slot: 'Weapon_1',
    skillWeapon: 'Lightning Hammer',
    categories: ['Weapon skill'],
    castTimeMs: 480,
    cooldown: 0,
    nextChainId: ID.STATIC_SWING,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 360,
            coefficient: 1
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.STATIC_SWING]: {
    name: 'Static Swing',
    type: 'Weapon',
    slot: 'Weapon_1',
    skillWeapon: 'Lightning Hammer',
    categories: ['Weapon skill'],
    castTimeMs: 640,
    cooldown: 0,
    nextChainId: ID.THUNDERCLAP,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 320,
            coefficient: 1
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.THUNDERCLAP]: {
    name: 'Thunderclap',
    type: 'Weapon',
    slot: 'Weapon_1',
    skillWeapon: 'Lightning Hammer',
    categories: ['Weapon skill'],
    castTimeMs: 440,
    cooldown: 0,
    nextChainId: ID.LIGHTNING_SWING,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 320, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 1.5,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      { type: 'blind', duration: 3, applications: 1, controlKind: 'blind' }
    ])
  },
  [ID.LIGHTNING_LEAP]: {
    name: 'Lightning Leap',
    type: 'Weapon',
    slot: 'Weapon_2',
    skillWeapon: 'Lightning Hammer',
    categories: ['Weapon skill'],
    castTimeMs: 960,
    cooldown: 8,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 800, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 1,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: 'Leap',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      { type: 'boon', boon: 'Quickness', stacks: 1, duration: 3, metadata: {} }
    ])
  },
  [ID.WIND_BLAST]: {
    name: 'Wind Blast',
    type: 'Weapon',
    slot: 'Weapon_3',
    skillWeapon: 'Lightning Hammer',
    categories: ['Weapon skill'],
    castTimeMs: 960,
    cooldown: 18,
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 680, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.33, canCrit: true },
      { type: 'buff', kind: 'superspeed', stacks: 1, duration: 3, metadata: {} },
      { type: 'control', applications: 1, controlKind: 'launch' }
    ])
  },
  [ID.INVOKE_LIGHTNING]: withSmallHitboxCap(
    {
      name: 'Invoke Lightning',
      type: 'Weapon',
      slot: 'Weapon_4',
      skillWeapon: 'Lightning Hammer',
      categories: ['Weapon skill'],
      castTimeMs: 920,
      cooldown: 20,
      skillFamily: 'Weapon skill',
      effects: [
        strikeTimeline(
          [
            { atMs: 360, coefficient: 0.825 },
            { atMs: 360, coefficient: 0.7425 },
            { atMs: 360, coefficient: 0.66 },
            { atMs: 480, coefficient: 0.5775 },
            { atMs: 480, coefficient: 0.495 },
            { atMs: 480, coefficient: 0.4125 },
            { atMs: 600, coefficient: 0.33 },
            { atMs: 600, coefficient: 0.2475 },
            { atMs: 600, coefficient: 0.24 },
            { atMs: 760, coefficient: 0.24 },
            { atMs: 760, coefficient: 0.24 },
            { atMs: 760, coefficient: 0.24 },
            { atMs: 880, coefficient: 0.24 },
            { atMs: 880, coefficient: 0.24 },
            { atMs: 880, coefficient: 0.24 },
            { atMs: 880, coefficient: 0.24 },
            { atMs: 880, coefficient: 0.24 },
            { atMs: 880, coefficient: 0.24 },
            { atMs: 1000, coefficient: 0.24 },
            { atMs: 1000, coefficient: 0.24 }
          ],
          { timingAnchor: 'castStart', timingScale: 'cast' }
        )
      ]
    },
    // Ten guaranteed hits plus half the ten random strikes on small targets; all twenty on large targets.
    15
  ),
  // The initial strike stuns once and opens a four-second Lightning field for subsequent finishers.
  [ID.STATIC_FIELD_LIGHTNING_HAMMER]: {
    name: 'Static Field',
    type: 'Weapon',
    slot: 'Weapon_5',
    skillWeapon: 'Lightning Hammer',
    categories: ['Weapon skill'],
    castTimeMs: 760,
    cooldown: 25,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Lightning',
        duration: 4,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Weapon skill',
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.5, canCrit: true },
      { type: 'control', applications: 1, controlKind: 'stun' }
    ])
  },
  // --- Fiery Greatsword (conjure elite) ---------------------------------------
  // Weapon_1 is a single skill that fires four evenly spaced waves rather than a chain.
  [ID.FLAME_WAVE]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Flame Wave',
    type: 'Weapon',
    slot: 'Weapon_1',
    skillWeapon: 'Fiery Greatsword',
    categories: ['Weapon skill'],
    castTimeMs: 2160,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 360,
            coefficient: 0.65
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 800,
            coefficient: 0.65
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1240,
            coefficient: 0.65
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1680,
            coefficient: 0.65
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  // Condition-only: no strike packet. Six Burning pulses one second apart continue for ~5s past
  // the end of the cast, so the fragment's effect timeline outlives its cast lane.
  [ID.FIERY_ERUPTION]: {
    name: 'Fiery Eruption',
    type: 'Weapon',
    slot: 'Weapon_2',
    skillWeapon: 'Fiery Greatsword',
    categories: ['Weapon skill'],
    castTimeMs: 720,
    cooldown: 5,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'condition',
        ticks: [
          {
            atMs: 720,
            condition: 'Burning',
            stacks: 1,
            duration: 3
          },
          {
            atMs: 1720,
            condition: 'Burning',
            stacks: 1,
            duration: 3
          },
          {
            atMs: 2720,
            condition: 'Burning',
            stacks: 1,
            duration: 3
          },
          {
            atMs: 3720,
            condition: 'Burning',
            stacks: 1,
            duration: 3
          },
          {
            atMs: 4720,
            condition: 'Burning',
            stacks: 1,
            duration: 3
          },
          {
            atMs: 5720,
            condition: 'Burning',
            stacks: 1,
            duration: 3
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.FIERY_WHIRL]: withSmallHitboxCap(
    {
      name: 'Fiery Whirl',
      type: 'Weapon',
      slot: 'Weapon_3',
      skillWeapon: 'Fiery Greatsword',
      categories: ['Weapon skill'],
      castTimeMs: 1320,
      cooldown: 5,
      skillFamily: 'Weapon skill',
      effects: [
        strikeTimeline(
          [
            { atMs: 280, coefficient: 0.688 },
            { atMs: 400, coefficient: 0.688 },
            { atMs: 520, coefficient: 0.688 },
            { atMs: 640, coefficient: 0.688 },
            { atMs: 760, coefficient: 0.688 },
            { atMs: 880, coefficient: 0.688 },
            { atMs: 1000, coefficient: 0.688 },
            { atMs: 1120, coefficient: 0.688 }
          ],
          {
            timingAnchor: 'castStart',
            timingScale: 'cast',
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Whirl',
                ambiguousFieldSelection: 'oldest'
              }
            ]
          }
        ),
        conditionTimeline(
          [280, 400, 520, 640, 760, 880, 1000, 1120].map((atMs) => ({
            atMs,
            condition: 'Cripple',
            stacks: 1,
            duration: 3
          })),
          { timingAnchor: 'castStart', timingScale: 'cast' }
        )
      ]
    },
    4
  ),
  [ID.FIERY_RUSH]: {
    name: 'Fiery Rush',
    type: 'Weapon',
    slot: 'Weapon_4',
    skillWeapon: 'Fiery Greatsword',
    categories: ['Weapon skill'],
    castTimeMs: 1280,
    cooldown: 10,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1080,
            coefficient: 2
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  // Ground field: nine one-second pulses that keep ticking long after the short cast ends.
  [ID.FIRESTORM]: {
    name: 'Firestorm',
    type: 'Weapon',
    slot: 'Weapon_5',
    skillWeapon: 'Fiery Greatsword',
    categories: ['Weapon skill'],
    castTimeMs: 760,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [520, 1520, 2520, 3520, 4520, 5520, 6520, 7520, 8520].map((atMs) => ({
          atMs,
          coefficient: 0.65
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  }
});
