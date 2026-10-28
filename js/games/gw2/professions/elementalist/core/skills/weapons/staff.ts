/**
 * Staff weapon-skill mechanics owned by the Core Elementalist module.
 *
 * Covers slots 1-5 across all four attunements. Staff is combo-field heavy: several entries
 * are ground-targeted fields whose damage arrives as `field-tick` packets long after the cast
 * ends, and some (Geyser, Healing Rain, Magnetic Aura) contribute only a field, aura, or boon
 * with no damage packets at all. Declarative data merged in by `core/skills/index.ts`.
 */
import {
  AURA,
  BOON,
  COMBO_FIELD,
  COMBO_FINISHER,
  CONDITION,
  CONTROL,
  RECIPIENT,
  STATUS,
  WEAPON
} from '#gw2/platform/constants.js';
import { impactEffects, strikeTimeline } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { withSmallHitboxCap } from '#gw2/professions/elementalist/core/skills/hitbox.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';

// Meteor Shower's canonical timeline retains the observed coefficient decay and packet timestamps.
const METEOR_SHOWER_STRIKE_TICKS = [
  { atMs: 2320, coefficient: 1.6 },
  { atMs: 2600, coefficient: 1.44 },
  { atMs: 2920, coefficient: 1.28 },
  { atMs: 3240, coefficient: 1.12 },
  { atMs: 3400, coefficient: 0.96 },
  { atMs: 3880, coefficient: 0.8 },
  { atMs: 4480, coefficient: 0.64 },
  { atMs: 4760, coefficient: 0.48 },
  { atMs: 5080, coefficient: 0.32 },
  { atMs: 5400, coefficient: 0.32 },
  { atMs: 5560, coefficient: 0.32 },
  { atMs: 6040, coefficient: 0.32 },
  { atMs: 6640, coefficient: 0.32 },
  { atMs: 6920, coefficient: 0.32 },
  { atMs: 7240, coefficient: 0.32 },
  { atMs: 7560, coefficient: 0.32 },
  { atMs: 7720, coefficient: 0.32 },
  { atMs: 8200, coefficient: 0.32 },
  { atMs: 8800, coefficient: 0.32 },
  { atMs: 9080, coefficient: 0.32 },
  { atMs: 9400, coefficient: 0.32 },
  { atMs: 9720, coefficient: 0.32 },
  { atMs: 9880, coefficient: 0.32 },
  { atMs: 10360, coefficient: 0.32 }
] as const;

/**
 * Skill-id keyed fragments the catalog layers over the raw staff skill records so the
 * simulator knows each skill's cast timeline, emitted packets, and combo participation.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const ELEMENTALIST_CORE_STAFF_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.FIREBALL]: {
    name: 'Fireball',
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.STAFF,
    attunement: 'Fire',
    categories: ['Weapon skill'],
    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 960,
    effects: impactEffects({ atMs: 720, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 1.4 },
      { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 1 }
    ])
  },
  // Four field-tick packets one second apart inside the 4s fire field, each burning.
  [ID.LAVA_FONT]: {
    name: 'Lava Font',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.STAFF,
    attunement: 'Fire',
    categories: ['Weapon skill'],
    cooldown: 6,
    skillFamily: 'Weapon skill',
    castTimeMs: 280,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.FIRE,
        duration: 4,
        startAnchor: 'castEnd'
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      // Field pulses land once per second; lifetime extensions add whole pulses on the same interval.
      {
        type: 'strike',
        coefficient: 0.525,
        damageKind: 'field-tick',
        atMs: 1160,
        applications: 4,
        intervalMs: 1000
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 1,
        atMs: 1160,
        applications: 4,
        intervalMs: 1000
      }
    ])
  },
  [ID.FLAME_BURST]: {
    name: 'Flame Burst',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.STAFF,
    attunement: 'Fire',
    categories: ['Weapon skill'],
    cooldown: 10,
    skillFamily: 'Weapon skill',
    castTimeMs: 360,
    effects: impactEffects({ atMs: 320, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 1 },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 3,
        duration: 6
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
  // Leaves a burning trail: one strike as the skill starts plus six field-tick packets one
  // second apart across the 6s fire field.
  [ID.BURNING_RETREAT]: {
    name: 'Burning Retreat',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.STAFF,
    attunement: 'Fire',
    categories: ['Weapon skill'],
    cooldown: 18,
    skillFamily: 'Weapon skill',
    castTimeMs: 1000,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.FIRE,
        duration: 6,
        startAnchor: 'castEnd'
      }
    ],
    effects: [
      ...impactEffects({ atMs: 80, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.2 },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 2 }
      ]),
      {
        type: 'strike',
        coefficient: 0.2,
        damageKind: 'field-tick',
        atMs: 1080,
        applications: 6,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 2,
        atMs: 1080,
        applications: 6,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  // Twenty-four meteors over roughly ten seconds; the shared tick table decays the coefficient
  // from 1.6 down to a 0.32 floor.
  [ID.METEOR_SHOWER]: withSmallHitboxCap(
    {
      name: 'Meteor Shower',
      type: 'Weapon',
      slot: 'Weapon_5',
      weapon: WEAPON.STAFF,
      attunement: 'Fire',
      categories: ['Weapon skill'],
      cooldown: 30,
      skillFamily: 'Weapon skill',
      castTimeMs: 2640,
      effects: [
        strikeTimeline(METEOR_SHOWER_STRIKE_TICKS, {
          timingAnchor: 'castStart',
          timingScale: 'cast'
        })
      ]
    },
    12
  ),
  [ID.WATER_BLAST]: {
    name: 'Water Blast',
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.STAFF,
    attunement: 'Water',
    categories: ['Weapon skill'],
    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 840,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 600,
            coefficient: 0.3
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  // Delayed drop: the blast finisher and its five Vulnerability stacks land at 1760ms.
  [ID.ICE_SPIKE]: {
    name: 'Ice Spike',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.STAFF,
    attunement: 'Water',
    categories: ['Weapon skill'],
    cooldown: 6,
    skillFamily: 'Weapon skill',
    castTimeMs: 520,
    effects: impactEffects({ atMs: 1760, timingAnchor: 'castStart', timingScale: 'cast' }, [
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
      { type: 'condition', condition: CONDITION.VULNERABILITY, stacks: 5, duration: 10 }
    ])
  },
  // Contributes only a water combo field; no strike or condition packets are modelled.
  [ID.GEYSER]: {
    name: 'Geyser',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.STAFF,
    attunement: 'Water',
    categories: ['Weapon skill'],
    cooldown: 20,
    skillFamily: 'Weapon skill',
    castTimeMs: 560,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.WATER,
        duration: 4,
        startAnchor: 'castEnd'
      }
    ],
    effects: []
  },
  // Ice field for combo purposes; only the initial Chilled application is emitted.
  [ID.FROZEN_GROUNDS]: {
    name: 'Frozen Grounds',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.STAFF,
    attunement: 'Water',
    categories: ['Weapon skill'],
    cooldown: 30,
    skillFamily: 'Weapon skill',
    castTimeMs: 280,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.ICE,
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'condition',
        ticks: [
          {
            atMs: 160,
            condition: CONDITION.CHILLED,
            stacks: 1,
            duration: 2
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.HEALING_RAIN]: {
    name: 'Healing Rain',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.STAFF,
    attunement: 'Water',
    categories: ['Weapon skill'],
    cooldown: 35,
    skillFamily: 'Weapon skill',
    castTimeMs: 840,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.WATER,
        duration: 6,
        startAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'boon',
        boon: BOON.REGENERATION,
        // Share this support boon with affected allies within its recipient cap.
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        stacks: 1,
        duration: 13,
        atMs: 720,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.CHAIN_LIGHTNING]: {
    name: 'Chain Lightning',
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.STAFF,
    attunement: 'Air',
    categories: ['Weapon skill'],
    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 840,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 600,
            coefficient: 0.8
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.LIGHTNING_SURGE]: {
    name: 'Lightning Surge',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.STAFF,
    attunement: 'Air',
    categories: ['Weapon skill'],
    cooldown: 10,
    skillFamily: 'Weapon skill',
    castTimeMs: 1000,
    effects: impactEffects({ atMs: 800, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 1.8 },
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 5,
        applications: 1
      }
    ])
  },
  [ID.GUST]: {
    name: 'Gust',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.STAFF,
    attunement: 'Air',
    categories: ['Weapon skill'],
    cooldown: 25,
    skillFamily: 'Weapon skill',
    castTimeMs: 480,
    effects: [
      {
        type: 'control',
        atMs: 200,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: CONTROL.KNOCKBACK
      }
    ]
  },
  [ID.WINDBORNE_SPEED]: {
    name: 'Windborne Speed',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.STAFF,
    attunement: 'Air',
    categories: ['Weapon skill'],
    cooldown: 20,
    skillFamily: 'Weapon skill',
    castTimeMs: 480,
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'boon',
        boon: BOON.SWIFTNESS,
        // Share this support boon with affected allies within its recipient cap.
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        stacks: 1,
        duration: 10
      },
      { type: 'buff', kind: STATUS.SUPERSPEED, stacks: 1, duration: 3 }
    ])
  },
  [ID.STATIC_FIELD]: {
    name: 'Static Field',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.STAFF,
    attunement: 'Air',
    categories: ['Weapon skill'],
    cooldown: 30,
    skillFamily: 'Weapon skill',
    castTimeMs: 680,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.LIGHTNING,
        duration: 4,
        startAnchor: 'castEnd'
      }
    ],
    effects: [
      ...impactEffects({ atMs: 680, timingAnchor: 'castStart', timingScale: 'cast' }, [
        { type: 'strike', coefficient: 0.5, canCrit: true },
        { type: 'control', controlKind: CONTROL.STUN }
      ])
    ]
  },
  [ID.STONING]: {
    name: 'Stoning',
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.STAFF,
    attunement: 'Earth',
    categories: ['Weapon skill'],
    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 880,
    effects: impactEffects({ atMs: 600, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 1.2,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: COMBO_FINISHER.PROJECTILE
          }
        ]
      },
      { type: 'condition', condition: CONDITION.WEAKNESS, stacks: 1, duration: 3 }
    ])
  },
  // Long fuse: the blast finisher, six Bleeding stacks, and Cripple all land at 4000ms.
  [ID.ERUPTION]: {
    name: 'Eruption',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.STAFF,
    attunement: 'Earth',
    categories: ['Weapon skill'],
    cooldown: 6,
    skillFamily: 'Weapon skill',
    castTimeMs: 840,
    effects: impactEffects({ atMs: 4000, timingAnchor: 'castStart', timingScale: 'cast' }, [
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
      { type: 'condition', condition: CONDITION.BLEEDING, stacks: 6, duration: 12 },
      { type: 'condition', condition: CONDITION.CRIPPLED, stacks: 1, duration: 3 }
    ])
  },
  // Aura/transmute flip pair: Magnetic Aura grants the aura and flips to Transmute Earth, which
  // is only available while that aura is active and consumes it for a blast finisher.
  [ID.MAGNETIC_AURA]: {
    name: AURA.MAGNETIC,
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.STAFF,
    attunement: 'Earth',
    categories: ['Weapon skill'],
    cooldown: 30,
    nextChainId: ID.TRANSMUTE_EARTH,
    skillFamily: 'Weapon skill',
    castTimeMs: 0,
    effects: [{ type: 'aura', aura: AURA.MAGNETIC, duration: 4 }]
  },
  [ID.TRANSMUTE_EARTH]: {
    name: 'Transmute Earth',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.STAFF,
    attunement: 'Earth',
    categories: ['Weapon skill'],
    cooldown: 10,
    nextChainId: ID.MAGNETIC_AURA,
    skillFamily: 'Weapon skill',
    castTimeMs: 360,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 840,
            coefficient: 1,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: COMBO_FINISHER.BLAST
              }
            ]
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    // Consume all live matching auras on commitment, regardless of which skill or trait granted them.
    sideEffects: [{ on: 'castCommit', do: { type: 'elementalist.transmute-aura' } }]
  },
  [ID.UNSTEADY_GROUND]: {
    name: 'Unsteady Ground',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.STAFF,
    attunement: 'Earth',
    categories: ['Weapon skill'],
    cooldown: 30,
    skillFamily: 'Weapon skill',
    castTimeMs: 720,
    effects: [
      {
        type: 'control',
        atMs: 400,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: CONTROL.KNOCKBACK
      }
    ]
  },
  // Projectile finisher carrying a 20s Bleeding stack plus a short Immobilize.
  [ID.SHOCK_WAVE]: {
    name: 'Shock Wave',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.STAFF,
    attunement: 'Earth',
    categories: ['Weapon skill'],
    cooldown: 25,
    skillFamily: 'Weapon skill',
    castTimeMs: 680,
    effects: impactEffects({ atMs: 600, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 2.5,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: COMBO_FINISHER.PROJECTILE
          }
        ]
      },
      { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 20 },
      { type: 'condition', condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 2 }
    ])
  }
});
