/**
 * Sword weapon-skill mechanics owned by the Core Elementalist module.
 *
 * Covers slots 1-3 across all four attunements. Every attunement has its own three-step
 * autoattack chain wired through `nextChainId` and looping back to its opener, plus two
 * cooldown skills in slots 2 and 3. Declarative data merged into the Core skill catalog by
 * `core/skills/index.ts`.
 */

import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/content/professions/elementalist/data/ids.js';
import { conditionTimeline, strikeTimeline } from '#gw2/platform/engine/effects/factories.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

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
 * Skill-id keyed fragments the catalog layers over the raw sword skill records so the
 * simulator knows each skill's cast timeline, emitted packets, and combo participation.
 */
export const ELEMENTALIST_CORE_SWORD_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  // Fire autoattack chain opener; Fire Strike -> Fire Swipe -> Searing Slash -> back, with only
  // the finisher applying Burning. The Water, Air, and Earth chains below follow the same shape.
  [ID.FIRE_STRIKE]: {
    name: 'Fire Strike',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Sword',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 440,
    cooldown: 0,
    nextChainId: ID.FIRE_SWIPE,
    skillFamily: 'Weapon skill',
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
    name: 'Fire Swipe',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Sword',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 440,
    cooldown: 0,
    nextChainId: ID.SEARING_SLASH,
    skillFamily: 'Weapon skill',
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
    name: 'Searing Slash',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Sword',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 680,
    cooldown: 0,
    nextChainId: ID.FIRE_STRIKE,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 480,
            coefficient: 1.8
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 480,
            condition: 'Burning',
            stacks: 1,
            duration: 4
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  // Leap finisher that lays its own short fire field, then two trailing field-tick packets one
  // second apart after the leap connects.
  [ID.FLAME_UPRISING]: {
    name: 'Flame Uprising',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Sword',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 720,
    cooldown: 8,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Fire',
        duration: 2,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 600,
            coefficient: 2,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Leap',
                ambiguousFieldSelection: 'oldest'
              }
            ],
            metadata: {}
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 600,
            condition: 'Burning',
            stacks: 1,
            duration: 4
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1600,
            coefficient: 0.5,
            damageKind: 'field-tick'
          },
          {
            atMs: 2600,
            coefficient: 0.5,
            damageKind: 'field-tick'
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.CAUTERIZING_STRIKE]: {
    name: 'Cauterizing Strike',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Sword',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 440,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 440,
            coefficient: 2.91
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 440,
            condition: 'Burning',
            stacks: 1,
            duration: 8
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.SEICHE]: {
    name: 'Seiche',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Sword',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 440,
    cooldown: 0,
    nextChainId: ID.CLAPOTIS,
    skillFamily: 'Weapon skill',
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
    name: 'Clapotis',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Sword',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 440,
    cooldown: 0,
    nextChainId: ID.BREAKING_WAVE,
    skillFamily: 'Weapon skill',
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
    name: 'Breaking Wave',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Sword',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 680,
    cooldown: 0,
    nextChainId: ID.SEICHE,
    skillFamily: 'Weapon skill',
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
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Sword',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 1080,
    cooldown: 12,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Water',
        duration: 4,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 40,
            coefficient: 0.33
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'Regeneration',
        stacks: 1,
        duration: 5,
        atMs: 40,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.AQUA_SIPHON]: {
    name: 'Aqua Siphon',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Sword',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 680,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 600,
            coefficient: 0.75
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'Regeneration',
        stacks: 1,
        duration: 5,
        atMs: 600,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.CHARGED_STRIKE]: {
    name: 'Charged Strike',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Sword',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 440,
    cooldown: 0,
    nextChainId: ID.POLARIC_SLASH,
    skillFamily: 'Weapon skill',
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
    name: 'Polaric Slash',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Sword',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 440,
    cooldown: 0,
    nextChainId: ID.CALL_LIGHTNING,
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
      },
      {
        type: 'boon',
        boon: 'Swiftness',
        stacks: 1,
        duration: 2,
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  // Chain finisher: the main strike at 560ms followed by three smaller bolts 200ms apart, which
  // land after the 760ms cast has ended.
  [ID.CALL_LIGHTNING]: {
    name: 'Call Lightning',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Sword',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 760,
    cooldown: 0,
    nextChainId: ID.CHARGED_STRIKE,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 560,
            coefficient: 1.2
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 760,
            coefficient: 0.32
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 960,
            coefficient: 0.32
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1160,
            coefficient: 0.32
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.POLARIC_LEAP]: {
    name: 'Polaric Leap',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Sword',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 440,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 280,
            coefficient: 0.66,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Leap',
                ambiguousFieldSelection: 'oldest'
              }
            ],
            metadata: {}
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        canCrit: true
      },
      {
        type: 'buff',
        kind: 'superspeed',
        stacks: 1,
        duration: 3,
        atMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 280,
            condition: 'Weakness',
            stacks: 1,
            duration: 3
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'control',
        atMs: 280,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: 'crowd-control'
      }
    ]
  },
  // Nine-packet flurry; the shared tick table keeps one Vulnerability stack aligned to each strike.
  [ID.QUANTUM_STRIKE]: {
    name: 'Quantum Strike',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Sword',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 680,
    cooldown: 16,
    skillFamily: 'Weapon skill',
    effects: [
      strikeTimeline(QUANTUM_STRIKE_TICKS, { timingAnchor: 'castStart', timingScale: 'cast' }),
      conditionTimeline(
        QUANTUM_STRIKE_TICKS.map(({ atMs }) => ({
          atMs,
          condition: 'Vulnerability',
          stacks: 1,
          duration: 8
        })),
        { timingAnchor: 'castStart', timingScale: 'cast' }
      )
    ]
  },
  [ID.CRYSTAL_SLASH]: {
    name: 'Crystal Slash',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Sword',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 440,
    cooldown: 0,
    nextChainId: ID.CRYSTALLINE_STRIKE,
    skillFamily: 'Weapon skill',
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
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 280,
            condition: 'Bleeding',
            stacks: 1,
            duration: 4
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.CRYSTALLINE_STRIKE]: {
    name: 'Crystalline Strike',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Sword',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 440,
    cooldown: 0,
    nextChainId: ID.CRYSTALLINE_SUNDER,
    skillFamily: 'Weapon skill',
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
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 360,
            condition: 'Bleeding',
            stacks: 1,
            duration: 4
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.CRYSTALLINE_SUNDER]: {
    name: 'Crystalline Sunder',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Sword',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 680,
    cooldown: 0,
    nextChainId: ID.CRYSTAL_SLASH,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 480,
            coefficient: 1.4
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 480,
            condition: 'Bleeding',
            stacks: 1,
            duration: 8
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 480,
            condition: 'Cripple',
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
  [ID.EARTHEN_VORTEX]: {
    name: 'Earthen Vortex',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Sword',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 1000,
    cooldown: 10,
    skillFamily: 'Weapon skill',
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 720,
            coefficient: 1.8,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Blast',
                ambiguousFieldSelection: 'oldest'
              }
            ],
            metadata: {}
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 720,
            condition: 'Bleeding',
            stacks: 2,
            duration: 8
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 720,
            condition: 'Cripple',
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
  // Eight paired packets, each applying its own Bleeding stack on the same timestamps.
  [ID.RUST_FRENZY]: {
    name: 'Rust Frenzy',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Sword',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 1400,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    effects: [
      strikeTimeline(
        RUST_FRENZY_TICKS.map((atMs) => ({ atMs, coefficient: 0.33 })),
        { timingAnchor: 'castStart', timingScale: 'cast' }
      ),
      conditionTimeline(
        RUST_FRENZY_TICKS.map((atMs) => ({
          atMs,
          condition: 'Bleeding',
          stacks: 1,
          duration: 4
        })),
        { timingAnchor: 'castStart', timingScale: 'cast' }
      )
    ]
  }
});
