/**
 * Owns Core Elementalist conjured-bundle weapon skill definitions.
 *
 * The table contains Frost Bow, Lightning Hammer, and Fiery Greatsword packet data only.
 * Equip, pickup, and recharge state lives in `core/mechanics/conjures.ts`.
 */
import { BOON, COMBO_FIELD, COMBO_FINISHER, CONDITION, CONTROL, STATUS } from '#gw2/platform/constants.js';
import { conditionTimeline, impactEffects, strikeTimeline } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { withSmallHitboxCap } from '#gw2/professions/elementalist/core/skills/hitbox.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';

/**
 * Skill-id → definition table for the conjured-bundle weapon skills.
 * Entries are keyed by GW2 skill ID and supply complete catalog entries.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const ELEMENTALIST_CONJURE_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  // --- Frost Bow (conjure) ---------------------------------------------------
  // `skillWeapon` is the bundle gate: availability blocks these unless the matching conjure is
  // equipped, and blocks normal weapon skills while it is (see core/mechanics/availability.ts).
  [ID.WATER_ARROW]: {
    name: 'Water Arrow',
    description:
      'Shoot an arrow of water that damages foes and heals allies around the area of impact. Gain a stack of Water Arrow each time you strike an enemy.',
    icon: 'https://render.guildwars2.com/file/DCF09BD74F77D6A9ADDADDA4A4B75005E752FCFF/103359.png',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    skillWeapon: 'Frost Bow',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 600,
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
    description:
      'Rapidly fire at your foe, making them vulnerable with each hit. Damage is increased per stack of Water Arrow.',
    icon: 'https://render.guildwars2.com/file/6652A34DDE59FB410EC21597B993796CA8B3EEED/103387.png',
    type: 'Weapon',
    slot: 'Weapon_2',
    skillWeapon: 'Frost Bow',

    cooldown: 6,
    skillFamily: 'Weapon skill',
    castTimeMs: 1600,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [360, 680, 1000, 1320, 1640].map((atMs) => ({
          atMs,
          coefficient: 0.5,
          comboFinishers: [
            {
              ownerId: 'elementalist',
              finisherType: COMBO_FINISHER.PROJECTILE
            }
          ]
        }))
      },
      {
        type: 'condition',
        ticks: [360, 680, 1000, 1320, 1640].map((atMs) => ({
          atMs,
          condition: CONDITION.VULNERABILITY,
          stacks: 1,
          duration: 15
        }))
      }
    ])
  },
  // Fan fires all seven packets (and their Chilled applications) at the same 240ms offset.
  [ID.FROST_FAN]: {
    name: 'Frost Fan',
    description:
      'Damage foes with a spread of icy arrows that cause chill. Extra projectiles are launched for each stack of Water Arrow accumulated.',
    icon: 'https://render.guildwars2.com/file/6A1AF3EF1C4441C1ED4A610B175459087A355163/103349.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    skillWeapon: 'Frost Bow',

    cooldown: 15,
    skillFamily: 'Weapon skill',
    castTimeMs: 560,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 1.75,
        hits: 7,
        atMs: 240
      },
      {
        type: 'condition',
        // Each projectile applies Chilled separately; author the shared payload once without merging applications.
        ticks: Array.from({ length: 7 }, () => ({ atMs: 240, condition: CONDITION.CHILLED, stacks: 1, duration: 1 }))
      }
    ])
  },
  // Channelled field: strikes reuse the shared tick timeline, and Bleeding rides every tick
  // except the opening one.
  [ID.FROST_STORM]: withSmallHitboxCap(
    {
      name: 'Frost Storm',
      description:
        'Call down an ice storm on the targeted area. The number of final ice shards are increased for each stack of Water Arrow.\nDamage is reduced per target each time foes are struck by this skill.',
      icon: 'https://render.guildwars2.com/file/6FB0BDB5ECB7DB4CA0FE1707450465C9BA80A501/103307.png',

      type: 'Weapon',
      slot: 'Weapon_4',
      skillWeapon: 'Frost Bow',

      cooldown: 20,
      skillFamily: 'Weapon skill',
      castTimeMs: 2360,
      // Share timing defaults while preserving each packet, effect order, and local schedule.
      effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
        strikeTimeline([
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
        ]),
        conditionTimeline(
          [
            1320, 1520, 1560, 1800, 1800, 2000, 2040, 2280, 2280, 2480, 2520, 2760, 2760, 2960, 3000, 3240, 3240, 3480,
            3720, 3960, 4240, 4480, 4720
          ].map((atMs) => ({
            atMs,
            condition: CONDITION.BLEEDING,
            stacks: 1,
            duration: 3
          }))
        )
      ])
    },
    14
  ),
  [ID.DEEP_FREEZE]: {
    name: 'Deep Freeze',
    description: 'Encase your target in a block of solid ice. Duration is increased per stack of Water Arrow.',
    icon: 'https://render.guildwars2.com/file/140358662D0F91686AF712B15ECF1B912DBF4700/103388.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    skillWeapon: 'Frost Bow',

    cooldown: 30,
    skillFamily: 'Weapon skill',
    castTimeMs: 1120,
    effects: impactEffects({ atMs: 1120, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.8, canCrit: true },
      { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 5 },
      { type: 'control', applications: 1, controlKind: CONTROL.STUN }
    ])
  },
  // --- Lightning Hammer (conjure) --------------------------------------------
  // Weapon_1 uses the explicit sequence in autoattack-chains.ts:
  // Lightning Swing → Static Swing → Thunderclap → back to Lightning Swing.
  [ID.LIGHTNING_SWING]: {
    // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Lightning Swing',
    description: 'Chain. Bash your foe.',
    icon: 'https://render.guildwars2.com/file/65F53318C0B21E19E753A81FBA3E3A600D6E12DC/103389.png',
    autoattack: true,
    type: 'Weapon',
    slot: 'Weapon_1',
    skillWeapon: 'Lightning Hammer',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 480,
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
    // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Static Swing',
    description: 'Chain. Strike your foe again.',
    icon: 'https://render.guildwars2.com/file/33C2E0E10F440C64564B022BBFC947599A5D0610/103390.png',
    autoattack: true,
    type: 'Weapon',
    slot: 'Weapon_1',
    skillWeapon: 'Lightning Hammer',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 640,
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
    // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Thunderclap',
    description: 'Smash the ground and damage nearby foes.',
    icon: 'https://render.guildwars2.com/file/C0F04BDA46A916545ACEB1C4214C4F214BE96810/103391.png',
    autoattack: true,
    type: 'Weapon',
    slot: 'Weapon_1',
    skillWeapon: 'Lightning Hammer',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 440,
    effects: impactEffects({ atMs: 320, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 1.5,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: COMBO_FINISHER.BLAST
          }
        ]
      },
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 3,
        applications: 1
      }
    ])
  },
  [ID.LIGHTNING_LEAP]: {
    name: 'Lightning Leap',
    description: 'Leap at your foe and hit them with electrical damage.',
    icon: 'https://render.guildwars2.com/file/A7EDEA66DD7C5E9EFF65A4054B23FEB8070AD394/103370.png',
    type: 'Weapon',
    slot: 'Weapon_2',
    skillWeapon: 'Lightning Hammer',

    cooldown: 8,
    skillFamily: 'Weapon skill',
    castTimeMs: 960,
    effects: impactEffects({ atMs: 800, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 1,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: COMBO_FINISHER.LEAP
          }
        ]
      },
      { type: 'boon', boon: BOON.QUICKNESS, stacks: 1, duration: 3 }
    ])
  },
  [ID.WIND_BLAST]: {
    name: 'Wind Blast',
    description: 'Launch your foe with a banishing smash.',
    icon: 'https://render.guildwars2.com/file/69200409BE3757744A271E1F7676DFF134B80E06/103392.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    skillWeapon: 'Lightning Hammer',

    cooldown: 18,
    skillFamily: 'Weapon skill',
    castTimeMs: 960,
    effects: impactEffects({ atMs: 680, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.33, canCrit: true },
      { type: 'buff', kind: STATUS.SUPERSPEED, stacks: 1, duration: 3 },
      { type: 'control', applications: 1, controlKind: CONTROL.LAUNCH }
    ])
  },
  [ID.INVOKE_LIGHTNING]: withSmallHitboxCap(
    {
      name: 'Invoke Lightning',
      description:
        'Randomly strike the surrounding area with lightning.\nDamage is reduced per target each time foes are struck by this skill.',
      icon: 'https://render.guildwars2.com/file/F513D2445AB3499CCC4B6E28044571583291A66D/103141.png',

      type: 'Weapon',
      slot: 'Weapon_4',
      skillWeapon: 'Lightning Hammer',

      cooldown: 20,
      skillFamily: 'Weapon skill',
      castTimeMs: 920,
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
    15
  ),
  // The initial strike stuns once and opens a four-second Lightning field for subsequent finishers.
  [ID.STATIC_FIELD_LIGHTNING_HAMMER]: {
    name: 'Static Field',
    description: 'Create an electrical field that stuns foes crossing it.',
    icon: 'https://render.guildwars2.com/file/C72B5BC2A1DC6243AF95C331BDC7CFE0D3F26F73/103182.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    skillWeapon: 'Lightning Hammer',

    cooldown: 25,
    skillFamily: 'Weapon skill',
    castTimeMs: 760,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.LIGHTNING,
        duration: 4,
        startAnchor: 'castEnd'
      }
    ],
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.5, canCrit: true },
      { type: 'control', applications: 1, controlKind: CONTROL.STUN }
    ])
  },
  // --- Fiery Greatsword (conjure elite) ---------------------------------------
  // Weapon_1 is a single skill that fires four evenly spaced waves rather than a chain.
  [ID.FLAME_WAVE]: {
    name: 'Flame Wave',
    description: 'Shoot a fireball at your foe with each swing.',
    icon: 'https://render.guildwars2.com/file/A1CF7CECF528E094A85D993569CD73B54FAF2C2D/103334.png',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    skillWeapon: 'Fiery Greatsword',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 2160,
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
  // the end of the cast, so the definition's effect timeline outlives its cast lane.
  [ID.FIERY_ERUPTION]: {
    name: 'Fiery Eruption',
    description: 'Ram your sword into the ground and make fire erupt near your foes.',
    icon: 'https://render.guildwars2.com/file/CC31AFD564F8090A34500C052A66634016F129F0/103335.png',
    type: 'Weapon',
    slot: 'Weapon_2',
    skillWeapon: 'Fiery Greatsword',

    cooldown: 5,
    skillFamily: 'Weapon skill',
    castTimeMs: 720,
    effects: [
      {
        type: 'condition',
        ticks: [
          {
            atMs: 720,
            condition: CONDITION.BURNING,
            stacks: 1,
            duration: 3
          },
          {
            atMs: 1720,
            condition: CONDITION.BURNING,
            stacks: 1,
            duration: 3
          },
          {
            atMs: 2720,
            condition: CONDITION.BURNING,
            stacks: 1,
            duration: 3
          },
          {
            atMs: 3720,
            condition: CONDITION.BURNING,
            stacks: 1,
            duration: 3
          },
          {
            atMs: 4720,
            condition: CONDITION.BURNING,
            stacks: 1,
            duration: 3
          },
          {
            atMs: 5720,
            condition: CONDITION.BURNING,
            stacks: 1,
            duration: 3
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.FIERY_WHIRL]: withSmallHitboxCap(
    {
      name: 'Fiery Whirl',
      description: 'Advance forward, slashing foes in your way.',
      icon: 'https://render.guildwars2.com/file/A0DF63425A55C89E3B96DA571F04B93CE16D7A35/103385.png',

      type: 'Weapon',
      slot: 'Weapon_3',
      skillWeapon: 'Fiery Greatsword',

      cooldown: 5,
      skillFamily: 'Weapon skill',
      castTimeMs: 1320,
      // Share timing defaults while preserving each packet, effect order, and local schedule.
      effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
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
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: COMBO_FINISHER.WHIRL
              }
            ]
          }
        ),
        conditionTimeline(
          [280, 400, 520, 640, 760, 880, 1000, 1120].map((atMs) => ({
            atMs,
            condition: CONDITION.CRIPPLED,
            stacks: 1,
            duration: 3
          }))
        )
      ])
    },
    4
  ),
  [ID.FIERY_RUSH]: {
    name: 'Fiery Rush',
    description: 'Charge at your foe, leaving a line of fire behind you.',
    icon: 'https://render.guildwars2.com/file/D7051607F7726AE1C3E4B80FE7F316244C075C0F/103329.png',
    type: 'Weapon',
    slot: 'Weapon_4',
    skillWeapon: 'Fiery Greatsword',

    cooldown: 10,
    skillFamily: 'Weapon skill',
    castTimeMs: 1280,
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
    description: 'Call down a firestorm on the target area.',
    icon: 'https://render.guildwars2.com/file/50A93174F3F9A1042654A7B00F146F31B2FABC09/103333.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    skillWeapon: 'Fiery Greatsword',

    cooldown: 15,
    skillFamily: 'Weapon skill',
    castTimeMs: 760,
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
