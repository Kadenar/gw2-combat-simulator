/**
 * Sword weapon-skill mechanics owned by the Core Elementalist module.
 *
 * Covers slots 1-3 across all four attunements. Every attunement has its own three-step
 * autoattack chain declared in `autoattack-chains.ts`, plus two
 * cooldown skills in slots 2 and 3. Declarative data merged into the Core skill catalog by
 * `core/skills/index.ts`.
 */
import {
  BOON,
  COMBO_FIELD,
  COMBO_FINISHER,
  CONDITION,
  CONTROL,
  RECIPIENT,
  STATUS,
  WEAPON
} from '#gw2/platform/constants.js';
import { conditionTimeline, impactEffects, strikeTimeline } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistSkill } from '#gw2/professions/elementalist/types.js';

// Canonical Sword timelines keep condition applications aligned with their originating strike packets.
const QUANTUM_STRIKE_TICKS = [
  { atMs: 600, coefficient: 0.5 },
  { atMs: 800, coefficient: 0.425 },
  { atMs: 1000, coefficient: 0.425 },
  { atMs: 1200, coefficient: 0.425 },
  { atMs: 1400, coefficient: 0.425 },
  { atMs: 1600, coefficient: 0.425 },
  { atMs: 1800, coefficient: 0.425 },
  { atMs: 2000, coefficient: 0.425 },
  { atMs: 2200, coefficient: 0.425 }
] as const;

// Rust Frenzy lands eight equal packets as four near-simultaneous pairs.
const RUST_FRENZY_TICKS = [360, 360, 600, 640, 840, 840, 1080, 1120] as const;

/**
 * Complete sword declarations own presentation, cast timelines, emitted packets, and combo participation.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const ELEMENTALIST_CORE_SWORD_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<ElementalistSkill>>> = {
  // Fire autoattack chain opener; Fire Strike -> Fire Swipe -> Searing Slash -> back, with only
  // the finisher applying Burning. The Water, Air, and Earth chains below follow the same shape.
  [ID.FIRE_STRIKE]: {
    // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Fire Strike',
    icon: 'https://render.guildwars2.com/file/01BBF5AFE8D46FAE7F3ABE04A7EA2065E203A010/1770361.png',
    autoattack: true,
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.SWORD,
    attunement: 'Fire',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 440,
    // The attack commits at the observed 400ms animation threshold.
    interruptCommitMs: 400,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 280,
            coefficient: 1
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.FIRE_SWIPE]: {
    // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Fire Swipe',
    icon: 'https://render.guildwars2.com/file/515620A36869D978A1E66FA135446D77A3C94F50/1770362.png',
    autoattack: true,
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.SWORD,
    attunement: 'Fire',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 440,
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 360,
            coefficient: 1.1
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.SEARING_SLASH]: {
    // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Searing Slash',
    icon: 'https://render.guildwars2.com/file/365C7D9672533C765C4DC819FC263D4C38AE0B1E/1770363.png',
    autoattack: true,
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.SWORD,
    attunement: 'Fire',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 680,
    interruptMode: 'per-packet',
    effects: impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 1.8 },
      { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 4 }
    ])
  },
  // Leap finisher that lays its own short fire field, then two trailing field-tick packets one
  // second apart after the leap connects.
  [ID.FLAME_UPRISING]: {
    name: 'Flame Uprising',
    icon: 'https://render.guildwars2.com/file/C4EF2F0EB22C2D0AEB40F6ADDD80F2A3D4BB0B7B/1770369.png',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.SWORD,
    attunement: 'Fire',

    cooldown: 8,
    skillFamily: 'Weapon skill',
    castTimeMs: 720,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.FIRE,
        duration: 2,
        startAnchor: 'castEnd'
      }
    ],
    effects: [
      ...impactEffects({ atMs: 600, timingAnchor: 'castStart', timingScale: 'cast' }, [
        {
          type: 'strike',
          coefficient: 2,
          comboFinishers: [
            {
              attemptGroup: 'effect:1:tick:1',
              ownerId: 'elementalist',
              finisherType: COMBO_FINISHER.LEAP
            }
          ]
        },
        { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 4 }
      ]),
      {
        type: 'strike',
        coefficient: 0.5,
        damageKind: 'field-tick',
        atMs: 1600,
        applications: 2,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.CAUTERIZING_STRIKE]: {
    name: 'Cauterizing Strike',
    icon: 'https://render.guildwars2.com/file/5CF5932ACF2EB9D17BE4DC634BB01EB3CC37070F/1770375.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SWORD,
    attunement: 'Fire',

    cooldown: 15,
    skillFamily: 'Weapon skill',
    castTimeMs: 440,
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 2.91 },
      { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 8 }
    ])
  },
  [ID.SEICHE]: {
    // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Seiche',
    icon: 'https://render.guildwars2.com/file/042718CC3B0C533D6DF4BFC103E901B6A90B13E2/1770364.png',
    autoattack: true,
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.SWORD,
    attunement: 'Water',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 440,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 280,
            coefficient: 0.8
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.CLAPOTIS]: {
    // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Clapotis',
    icon: 'https://render.guildwars2.com/file/2019DD99B0260C064DD1EDB504307518441FB109/1770365.png',
    autoattack: true,
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.SWORD,
    attunement: 'Water',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 440,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 360,
            coefficient: 0.9
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.BREAKING_WAVE]: {
    // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Breaking Wave',
    icon: 'https://render.guildwars2.com/file/99AE33BF5F03749CA414B033FC3D6762C3A4FE50/1770366.png',
    autoattack: true,
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.SWORD,
    attunement: 'Water',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 680,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 480,
            coefficient: 1.1
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  // Front-loaded strike at 40ms plus Regeneration, leaving a 4s water field behind the cast.
  [ID.RIPTIDE]: {
    name: 'Riptide',
    icon: 'https://render.guildwars2.com/file/07D74E01540900CD96A9BDCB3023EECBBB0EAB6B/1770370.png',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.SWORD,
    attunement: 'Water',

    cooldown: 12,
    skillFamily: 'Weapon skill',
    castTimeMs: 1080,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: COMBO_FIELD.WATER,
        duration: 4,
        startAnchor: 'castEnd'
      }
    ],
    effects: impactEffects({ atMs: 40, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.33 },
      { type: 'boon', boon: BOON.REGENERATION, stacks: 1, duration: 5 }
    ])
  },
  [ID.AQUA_SIPHON]: {
    name: 'Aqua Siphon',
    icon: 'https://render.guildwars2.com/file/0FF207987424A1B0A6DEF7E2140CB010DCB948BB/1770379.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SWORD,
    attunement: 'Water',

    cooldown: 15,
    skillFamily: 'Weapon skill',
    castTimeMs: 680,
    effects: impactEffects({ atMs: 600, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.75 },
      {
        type: 'boon',
        boon: BOON.REGENERATION,
        // Share this support boon with affected allies within its recipient cap.
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        stacks: 1,
        duration: 5
      }
    ])
  },
  [ID.CHARGED_STRIKE]: {
    // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Charged Strike',
    icon: 'https://render.guildwars2.com/file/69521650FA42B136CCCBA3EC01EED74C3BF3A3DA/1770355.png',
    autoattack: true,
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.SWORD,
    attunement: 'Air',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 440,
    // The attack commits at the observed 400ms animation threshold.
    interruptCommitMs: 400,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 280,
            coefficient: 0.9
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.POLARIC_SLASH]: {
    // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Polaric Slash',
    icon: 'https://render.guildwars2.com/file/CAB0C907C03A00540849085DE2ACAB54BF0156DE/1770356.png',
    autoattack: true,
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.SWORD,
    attunement: 'Air',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 440,
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 1 },
      { type: 'boon', boon: BOON.SWIFTNESS, stacks: 1, duration: 2 }
    ])
  },
  // Chain finisher: the main strike commits the attack at 560ms, then the three launched bolts
  // keep landing after an animation cancel or the ordinary 760ms cast end.
  [ID.CALL_LIGHTNING]: {
    // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Call Lightning',
    icon: 'https://render.guildwars2.com/file/166E751B3C56196EC1E8B323400C5AFCEC3C0C01/1770357.png',
    autoattack: true,
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.SWORD,
    attunement: 'Air',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 760,
    interruptCommitMs: 560,
    effects: [
      // The main hit and launched bolts share one timeline and survive cancellation after commit.
      strikeTimeline(
        [
          { atMs: 560, coefficient: 1.2 },
          { atMs: 760, coefficient: 0.32 },
          { atMs: 960, coefficient: 0.32 },
          { atMs: 1160, coefficient: 0.32 }
        ],
        { timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }
      )
    ]
  },
  [ID.POLARIC_LEAP]: {
    name: 'Polaric Leap',
    icon: 'https://render.guildwars2.com/file/62486C9906C4B4D5D6A8112CF671743F01DF392F/1770367.png',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.SWORD,
    attunement: 'Air',

    cooldown: 15,
    skillFamily: 'Weapon skill',
    castTimeMs: 440,
    effects: impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 0.66,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: COMBO_FINISHER.LEAP
          }
        ],

        canCrit: true
      },
      { type: 'buff', kind: STATUS.SUPERSPEED, stacks: 1, duration: 3 },
      { type: 'condition', condition: CONDITION.WEAKNESS, stacks: 1, duration: 3 },
      { type: 'control', applications: 1, controlKind: CONTROL.DAZE }
    ])
  },
  // Nine-packet flurry; the shared tick table keeps one Vulnerability stack aligned to each strike.
  [ID.QUANTUM_STRIKE]: {
    name: 'Quantum Strike',
    icon: 'https://render.guildwars2.com/file/0D4D42EF67E9EB0B4A0304CF39901661ED087BE5/1770371.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SWORD,
    attunement: 'Air',

    cooldown: 16,
    skillFamily: 'Weapon skill',
    castTimeMs: 680,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      strikeTimeline(QUANTUM_STRIKE_TICKS),
      conditionTimeline(
        QUANTUM_STRIKE_TICKS.map(({ atMs }) => ({
          atMs,
          condition: CONDITION.VULNERABILITY,
          stacks: 1,
          duration: 8
        }))
      )
    ])
  },
  [ID.CRYSTAL_SLASH]: {
    // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Crystal Slash',
    icon: 'https://render.guildwars2.com/file/083CE8B4C86A115123440703072E0E453D1A0A27/1770358.png',
    autoattack: true,
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.SWORD,
    attunement: 'Earth',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 440,
    effects: impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.8 },
      { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 4 }
    ])
  },
  [ID.CRYSTALLINE_STRIKE]: {
    // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Crystalline Strike',
    icon: 'https://render.guildwars2.com/file/0D06CA7F9D03A4166900C4003DBB0EE910736A08/1770359.png',
    autoattack: true,
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.SWORD,
    attunement: 'Earth',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 440,
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.9 },
      { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 4 }
    ])
  },
  [ID.CRYSTALLINE_SUNDER]: {
    // Ordinary repeatable attack; excluded from player-input metrics.
    name: 'Crystalline Sunder',
    icon: 'https://render.guildwars2.com/file/03586ED169D344CFAA513763B616C152F839C153/1770360.png',
    autoattack: true,
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: WEAPON.SWORD,
    attunement: 'Earth',

    cooldown: 0,
    skillFamily: 'Weapon skill',
    castTimeMs: 680,
    effects: impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 1.4 },
      { type: 'condition', condition: CONDITION.BLEEDING, stacks: 1, duration: 8 },
      { type: 'condition', condition: CONDITION.CRIPPLED, stacks: 1, duration: 3 }
    ])
  },
  [ID.EARTHEN_VORTEX]: {
    name: 'Earthen Vortex',
    icon: 'https://render.guildwars2.com/file/2F12CFE8B84805BEBB563D0897E6102DB380512D/1770368.png',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: WEAPON.SWORD,
    attunement: 'Earth',

    cooldown: 10,
    skillFamily: 'Weapon skill',
    castTimeMs: 1000,
    effects: impactEffects({ atMs: 720, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 1.8,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: COMBO_FINISHER.BLAST
          }
        ]
      },
      { type: 'condition', condition: CONDITION.BLEEDING, stacks: 2, duration: 8 },
      { type: 'condition', condition: CONDITION.CRIPPLED, stacks: 1, duration: 3 }
    ])
  },
  // Eight paired packets, each applying its own six-second Bleeding stack on the same timestamps.
  [ID.RUST_FRENZY]: {
    name: 'Rust Frenzy',
    icon: 'https://render.guildwars2.com/file/B16E9EE2AACD62042A64356334DC726E1E7FBF7B/1770372.png',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: WEAPON.SWORD,
    attunement: 'Earth',

    cooldown: 15,
    skillFamily: 'Weapon skill',
    castTimeMs: 1400,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      strikeTimeline(RUST_FRENZY_TICKS.map((atMs) => ({ atMs, coefficient: 0.33 }))),
      conditionTimeline(
        RUST_FRENZY_TICKS.map((atMs) => ({
          atMs,
          condition: CONDITION.BLEEDING,
          stacks: 1,
          duration: 6
        }))
      )
    ])
  }
};
