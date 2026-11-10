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
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { withSmallHitboxCap } from '#gw2/professions/elementalist/core/skills/hitbox.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistSkill } from '#gw2/professions/elementalist/types.js';

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
 * Complete staff declarations own presentation, cast timelines, emitted packets, and combo participation.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const ELEMENTALIST_CORE_STAFF_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<ElementalistSkill>>> = {
  [ID.FIREBALL]: {
    name: 'Fireball',
    icon: 'https://render.guildwars2.com/file/E57B9C0358A6B1CE4631E336D22614E9E544DD4B/102965.png',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.STAFF,
    attunement: 'Fire',

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
    icon: 'https://render.guildwars2.com/file/CFA80DB42022C240001D249CED6235CEF70C9042/103135.png',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.STAFF,
    attunement: 'Fire',

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
    icon: 'https://render.guildwars2.com/file/610424237E18EA90F0D824454104355309FF5DDA/102959.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.STAFF,
    attunement: 'Fire',

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
    icon: 'https://render.guildwars2.com/file/45A8C3A3F534C7E8E371D41C693AC87A019D2E65/103204.png',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.STAFF,
    attunement: 'Fire',

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
      icon: 'https://render.guildwars2.com/file/660B4E695A6026F9D70CA6B0D7565774805C6B0E/103255.png',

      type: 'Weapon',
      slot: 'Weapon_5',
      weapon: WEAPON.STAFF,
      attunement: 'Fire',

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
    icon: 'https://render.guildwars2.com/file/FE0B500420CE04976E45D370B0EC6EC874B1E5FE/103184.png',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.STAFF,
    attunement: 'Water',

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
    icon: 'https://render.guildwars2.com/file/755303C9C50299D8E3F7166B6C23EA18D20B3644/103067.png',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.STAFF,
    attunement: 'Water',

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
    icon: 'https://render.guildwars2.com/file/4CCE5E636B2FCD33495780FB1BCD02A3666DEEBC/103290.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.STAFF,
    attunement: 'Water',

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
    icon: 'https://render.guildwars2.com/file/5EE193655A445A5E9ED31EE7121E01C0B113907E/103217.png',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.STAFF,
    attunement: 'Water',

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
    icon: 'https://render.guildwars2.com/file/B91D94720FB5979FED339EC7B1E55071076B5E0F/103262.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.STAFF,
    attunement: 'Water',

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
    icon: 'https://render.guildwars2.com/file/01D310FE65DBA378CBAFD13B2BFEDE59939C5153/102964.png',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.STAFF,
    attunement: 'Air',

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
    icon: 'https://render.guildwars2.com/file/74BF0A9D002750671D0428CC28BFAC35372AE422/102797.png',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.STAFF,
    attunement: 'Air',

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
    icon: 'https://render.guildwars2.com/file/F457134ECFA949C4A47525B30E07A1534542E172/103276.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.STAFF,
    attunement: 'Air',

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
    icon: 'https://render.guildwars2.com/file/541CA5AAA1E95B93346D4FF80C7C6CCCC9909A2E/103381.png',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.STAFF,
    attunement: 'Air',

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
    icon: 'https://render.guildwars2.com/file/C72B5BC2A1DC6243AF95C331BDC7CFE0D3F26F73/103182.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.STAFF,
    attunement: 'Air',

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
    icon: 'https://render.guildwars2.com/file/49245DDFC55F4BBCAF0AA580B20A030F677221EF/103186.png',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.STAFF,
    attunement: 'Earth',

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
    icon: 'https://render.guildwars2.com/file/2F1CF7CA4E58215911CF5797F7939FEF51D9CB45/102977.png',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.STAFF,
    attunement: 'Earth',

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
    icon: 'https://render.guildwars2.com/file/048054BEC158D010706002C22AF47952ECC5A33C/103108.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.STAFF,
    attunement: 'Earth',

    cooldown: 30,
    skillFamily: 'Weapon skill',
    castTimeMs: 0,
    effects: [{ type: 'aura', aura: AURA.MAGNETIC, duration: 4 }]
  },
  [ID.TRANSMUTE_EARTH]: {
    name: 'Transmute Earth',
    icon: 'https://render.guildwars2.com/file/6707FCC7A3DF19453F57046821BF682EF3CDFE06/2029299.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.STAFF,
    attunement: 'Earth',

    cooldown: 10,
    skillFamily: 'Weapon skill',
    castTimeMs: 360,
    // Availability and consumption use the same declared aura.
    transmuteAura: AURA.MAGNETIC,
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
    icon: 'https://render.guildwars2.com/file/97F7094E7F32BD1A4C547AD74167744BE44CBC3E/103303.png',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: WEAPON.STAFF,
    attunement: 'Earth',

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
    icon: 'https://render.guildwars2.com/file/69CFF22DD8599E35164720AC02A5F2044C33C7DD/103136.png',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: WEAPON.STAFF,
    attunement: 'Earth',

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
};
