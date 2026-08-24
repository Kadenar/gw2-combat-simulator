/** Core Elementalist skill mechanics. */
import { ELEMENTALIST_SKILL_IDS as ID } from '../data/ids.js';
import { elementalistPacketEffects } from './skill-effects.js';
import type { Skill, SkillFragment } from '../../../platform/engine/types.js';
import { ELEMENTALIST_CORE_DAGGER_SKILL_MECHANICS } from './skill-data/dagger.js';
import { ELEMENTALIST_CORE_FOCUS_SKILL_MECHANICS } from './skill-data/focus.js';
import { ELEMENTALIST_CORE_HAMMER_SKILL_MECHANICS } from './skill-data/hammer.js';
import { ELEMENTALIST_CORE_PISTOL_SKILL_MECHANICS } from './skill-data/pistol.js';
import { ELEMENTALIST_CORE_SCEPTER_SKILL_MECHANICS } from './skill-data/scepter.js';
import { ELEMENTALIST_CORE_SPEAR_SKILL_MECHANICS } from './skill-data/spear.js';
import { ELEMENTALIST_CORE_STAFF_SKILL_MECHANICS } from './skill-data/staff.js';
import { ELEMENTALIST_CORE_SWORD_SKILL_MECHANICS } from './skill-data/sword.js';
import { ELEMENTALIST_CORE_WARHORN_SKILL_MECHANICS } from './skill-data/warhorn.js';

// Cast-scaled packet data is authored on the Quickness timeline and expands only for slower casts.
const FROST_VOLLEY_TICK_OFFSETS_MS = [360, 680, 1000, 1320, 1640] as const;
const GLYPH_OF_STORMS_FIRE_EARTH_TICK_OFFSETS_MS = [
  880, 1880, 2880, 3880, 4880, 5880, 6880, 7880, 8880, 9880, 10880
] as const;
const FIRESTORM_TICK_OFFSETS_MS = [520, 1520, 2520, 3520, 4520, 5520, 6520, 7520, 8520] as const;

// Composes physical-weapon fragments with Core attunements, utilities, conjures, and synthetic actions.
export const ELEMENTALIST_CORE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  ...ELEMENTALIST_CORE_DAGGER_SKILL_MECHANICS,
  ...ELEMENTALIST_CORE_FOCUS_SKILL_MECHANICS,
  ...ELEMENTALIST_CORE_HAMMER_SKILL_MECHANICS,
  ...ELEMENTALIST_CORE_PISTOL_SKILL_MECHANICS,
  ...ELEMENTALIST_CORE_SCEPTER_SKILL_MECHANICS,
  ...ELEMENTALIST_CORE_SPEAR_SKILL_MECHANICS,
  ...ELEMENTALIST_CORE_STAFF_SKILL_MECHANICS,
  ...ELEMENTALIST_CORE_SWORD_SKILL_MECHANICS,
  ...ELEMENTALIST_CORE_WARHORN_SKILL_MECHANICS,
  [ID.FIRE_ATTUNEMENT]: {
    name: 'Fire Attunement',
    type: 'Profession',
    slot: 'Profession_1',
    mechanicSlot: 1,
    categories: ['Attunement'],
    quicknessCastTimeMs: 0,
    cooldown: 0,
    canCastConcurrently: true,
    skillFamily: 'Attunement',
    implemented: true,
    effects: []
  },
  [ID.WATER_ATTUNEMENT]: {
    name: 'Water Attunement',
    type: 'Profession',
    slot: 'Profession_2',
    mechanicSlot: 2,
    categories: ['Attunement'],
    quicknessCastTimeMs: 0,
    cooldown: 0,
    canCastConcurrently: true,
    skillFamily: 'Attunement',
    implemented: true,
    effects: []
  },
  [ID.AIR_ATTUNEMENT]: {
    name: 'Air Attunement',
    type: 'Profession',
    slot: 'Profession_3',
    mechanicSlot: 3,
    categories: ['Attunement'],
    quicknessCastTimeMs: 0,
    cooldown: 0,
    canCastConcurrently: true,
    skillFamily: 'Attunement',
    implemented: true,
    effects: []
  },
  [ID.EARTH_ATTUNEMENT]: {
    name: 'Earth Attunement',
    type: 'Profession',
    slot: 'Profession_4',
    mechanicSlot: 4,
    categories: ['Attunement'],
    quicknessCastTimeMs: 0,
    cooldown: 0,
    canCastConcurrently: true,
    skillFamily: 'Attunement',
    implemented: true,
    effects: []
  },
  [ID.ARCANE_BRILLIANCE]: {
    name: 'Arcane Brilliance',
    type: 'Heal',
    slot: 'Heal',
    categories: ['Arcane'],
    quicknessCastTimeMs: 640,
    cooldown: 20,
    skillFamily: 'Arcane',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 520,
            coefficient: 0.5,
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
      }
    ]
  },
  [ID.SIGNET_OF_RESTORATION]: {
    name: 'Signet of Restoration',
    type: 'Heal',
    slot: 'Heal',
    categories: ['Signet'],
    quicknessCastTimeMs: 440,
    cooldown: 20,
    skillFamily: 'Signet',
    implemented: true,
    effects: []
  },
  [ID.GLYPH_OF_ELEMENTAL_HARMONY]: {
    name: 'Glyph of Elemental Harmony',
    type: 'Heal',
    slot: 'Heal',
    categories: ['Glyph'],
    quicknessCastTimeMs: 800,
    cooldown: 20,
    skillFamily: 'Glyph',
    implemented: true,
    effects: [
      {
        type: 'boon',
        boon: 'Might',
        stacks: 3,
        duration: 20,
        atMs: 680,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.ARCANE_BLAST]: {
    name: 'Arcane Blast',
    type: 'Utility',
    slot: 'Utility',
    categories: ['Arcane'],
    quicknessCastTimeMs: 0,
    cooldown: 1,
    ammo: 3,
    ammoRecharge: 20,
    skillFamily: 'Arcane',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 1.4,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Projectile',
                ambiguousFieldSelection: 'oldest'
              }
            ],
            metadata: {}
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.ARCANE_ECHO]: {
    name: 'Arcane Echo',
    type: 'Utility',
    slot: 'Utility',
    categories: ['Arcane'],
    quicknessCastTimeMs: 0,
    cooldown: 15,
    skillFamily: 'Arcane',
    implemented: true,
    effects: []
  },
  [ID.ARCANE_WAVE]: {
    name: 'Arcane Wave',
    type: 'Utility',
    slot: 'Utility',
    categories: ['Arcane'],
    quicknessCastTimeMs: 760,
    cooldown: 2,
    ammo: 2,
    ammoRecharge: 25,
    skillFamily: 'Arcane',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 800,
            coefficient: 1.4,
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
        timingScale: 'cast',
        canCrit: true
      },
      {
        type: 'control',
        atMs: 800,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'crowd-control'
        }
      }
    ]
  },
  [ID.CONJURE_FROST_BOW]: {
    name: 'Conjure Frost Bow',
    type: 'Utility',
    slot: 'Utility',
    categories: ['Conjure'],
    quicknessCastTimeMs: 480,
    cooldown: 60,
    skillFamily: 'Conjure',
    implemented: true,
    effects: []
  },
  [ID.CONJURE_LIGHTNING_HAMMER]: {
    name: 'Conjure Lightning Hammer',
    type: 'Utility',
    slot: 'Utility',
    categories: ['Conjure'],
    quicknessCastTimeMs: 880,
    cooldown: 60,
    skillFamily: 'Conjure',
    implemented: true,
    effects: []
  },
  [ID.WATER_ARROW]: {
    name: 'Water Arrow',
    type: 'Weapon',
    slot: 'Weapon_1',
    skillWeapon: 'Frost Bow',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 600,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    implemented: true,
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
    quicknessCastTimeMs: 1600,
    cooldown: 6,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: FROST_VOLLEY_TICK_OFFSETS_MS.map((atMs) => ({
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
        ticks: FROST_VOLLEY_TICK_OFFSETS_MS.map((atMs) => ({
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
  [ID.FROST_FAN]: {
    name: 'Frost Fan',
    type: 'Weapon',
    slot: 'Weapon_3',
    skillWeapon: 'Frost Bow',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 560,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 240,
            coefficient: 0.25
          },
          {
            atMs: 240,
            coefficient: 0.25
          },
          {
            atMs: 240,
            coefficient: 0.25
          },
          {
            atMs: 240,
            coefficient: 0.25
          },
          {
            atMs: 240,
            coefficient: 0.25
          },
          {
            atMs: 240,
            coefficient: 0.25
          },
          {
            atMs: 240,
            coefficient: 0.25
          }
        ],
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
  [ID.FROST_STORM]: {
    name: 'Frost Storm',
    type: 'Weapon',
    slot: 'Weapon_4',
    skillWeapon: 'Frost Bow',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 2360,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: elementalistPacketEffects(
      [
        [1040, 0.7],
        [1320, 0.63],
        [1520, 0.56],
        [1560, 0.49],
        [1800, 0.42],
        [1800, 0.35],
        [2000, 0.28],
        [2040, 0.21],
        [2280, 0.14],
        [2280, 0.14],
        [2480, 0.14],
        [2520, 0.14],
        [2760, 0.14],
        [2760, 0.14],
        [2960, 0.14],
        [3000, 0.14],
        [3240, 0.14],
        [3240, 0.14],
        [3480, 0.14],
        [3720, 0.14],
        [3960, 0.14],
        [4240, 0.14],
        [4480, 0.14],
        [4720, 0.14]
      ],
      {
        condition: { condition: 'Bleeding', stacks: 1, duration: 3 },
        conditionStartIndex: 1
      }
    )
  },
  [ID.DEEP_FREEZE]: {
    name: 'Deep Freeze',
    type: 'Weapon',
    slot: 'Weapon_5',
    skillWeapon: 'Frost Bow',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 1120,
    cooldown: 30,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1120,
            coefficient: 0.8
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        canCrit: true
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 1120,
            condition: 'Chilled',
            stacks: 1,
            duration: 5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'control',
        atMs: 1120,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'crowd-control'
        }
      }
    ]
  },
  [ID.LIGHTNING_SWING]: {
    name: 'Lightning Swing',
    type: 'Weapon',
    slot: 'Weapon_1',
    skillWeapon: 'Lightning Hammer',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 480,
    cooldown: 0,
    nextChainId: ID.STATIC_SWING,
    skillFamily: 'Weapon skill',
    implemented: true,
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
    quicknessCastTimeMs: 640,
    cooldown: 0,
    nextChainId: ID.THUNDERCLAP,
    skillFamily: 'Weapon skill',
    implemented: true,
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
    quicknessCastTimeMs: 440,
    cooldown: 0,
    nextChainId: ID.LIGHTNING_SWING,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 320,
            coefficient: 1.5,
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
        type: 'blind',
        atMs: 320,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'blind'
        }
      }
    ]
  },
  [ID.LIGHTNING_LEAP]: {
    name: 'Lightning Leap',
    type: 'Weapon',
    slot: 'Weapon_2',
    skillWeapon: 'Lightning Hammer',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 960,
    cooldown: 8,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 800,
            coefficient: 1,
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
        type: 'boon',
        boon: 'Quickness',
        stacks: 1,
        duration: 3,
        atMs: 800,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.WIND_BLAST]: {
    name: 'Wind Blast',
    type: 'Weapon',
    slot: 'Weapon_3',
    skillWeapon: 'Lightning Hammer',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 960,
    cooldown: 18,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 680,
            coefficient: 0.33
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
        atMs: 680,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'control',
        atMs: 680,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'crowd-control'
        }
      }
    ]
  },
  [ID.INVOKE_LIGHTNING]: {
    name: 'Invoke Lightning',
    type: 'Weapon',
    slot: 'Weapon_4',
    skillWeapon: 'Lightning Hammer',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 920,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: elementalistPacketEffects([
      [360, 0.825],
      [360, 0.7425],
      [360, 0.66],
      [480, 0.5775],
      [480, 0.495],
      [480, 0.4125],
      [600, 0.33],
      [600, 0.2475],
      [600, 0.24],
      [760, 0.24],
      [760, 0.24],
      [760, 0.24],
      [880, 0.24],
      [880, 0.24],
      [880, 0.24],
      [880, 0.24],
      [880, 0.24],
      [880, 0.24],
      [1000, 0.24],
      [1000, 0.24]
    ])
  },
  [ID.STATIC_FIELD_LIGHTNING_HAMMER]: {
    name: 'Static Field',
    type: 'Weapon',
    slot: 'Weapon_5',
    skillWeapon: 'Lightning Hammer',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 760,
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
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 180,
            coefficient: 0.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        canCrit: true
      },
      {
        type: 'control',
        atMs: 180,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'crowd-control'
        }
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 680,
            coefficient: 0.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        canCrit: true
      },
      {
        type: 'control',
        atMs: 680,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'crowd-control'
        }
      }
    ]
  },
  [ID.GLYPH_OF_ELEMENTAL_POWER_FIRE]: {
    name: 'Glyph of Elemental Power (Fire)',
    type: 'Utility',
    slot: 'Utility',
    attunement: 'Fire',
    categories: ['Glyph'],
    quicknessCastTimeMs: 480,
    cooldown: 25,
    skillFamily: 'Glyph',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 400,
            coefficient: 1.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 400,
            condition: 'Burning',
            stacks: 3,
            duration: 6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.GLYPH_OF_ELEMENTAL_POWER_WATER]: {
    name: 'Glyph of Elemental Power (Water)',
    type: 'Utility',
    slot: 'Utility',
    attunement: 'Water',
    categories: ['Glyph'],
    quicknessCastTimeMs: 480,
    cooldown: 25,
    skillFamily: 'Glyph',
    implemented: true,
    effects: []
  },
  [ID.GLYPH_OF_ELEMENTAL_POWER_AIR]: {
    name: 'Glyph of Elemental Power (Air)',
    type: 'Utility',
    slot: 'Utility',
    attunement: 'Air',
    categories: ['Glyph'],
    quicknessCastTimeMs: 480,
    cooldown: 25,
    skillFamily: 'Glyph',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 400,
            coefficient: 0.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        canCrit: true
      },
      {
        type: 'control',
        atMs: 400,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'crowd-control'
        }
      }
    ]
  },
  [ID.GLYPH_OF_ELEMENTAL_POWER_EARTH]: {
    name: 'Glyph of Elemental Power (Earth)',
    type: 'Utility',
    slot: 'Utility',
    attunement: 'Earth',
    categories: ['Glyph'],
    quicknessCastTimeMs: 480,
    cooldown: 25,
    skillFamily: 'Glyph',
    implemented: true,
    effects: []
  },
  [ID.GLYPH_OF_STORMS_FIRE]: {
    name: 'Glyph of Storms (Fire)',
    type: 'Utility',
    slot: 'Utility',
    attunement: 'Fire',
    categories: ['Glyph'],
    quicknessCastTimeMs: 1120,
    cooldown: 25,
    skillFamily: 'Glyph',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: GLYPH_OF_STORMS_FIRE_EARTH_TICK_OFFSETS_MS.map((atMs) => ({
          atMs,
          coefficient: 0.5,
          metadata: {
            damageKind: 'field-tick'
          }
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: GLYPH_OF_STORMS_FIRE_EARTH_TICK_OFFSETS_MS.map((atMs) => ({
          atMs,
          condition: 'Burning',
          stacks: 1,
          duration: 2
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.GLYPH_OF_STORMS_WATER]: {
    name: 'Glyph of Storms (Water)',
    type: 'Utility',
    slot: 'Utility',
    attunement: 'Water',
    categories: ['Glyph'],
    quicknessCastTimeMs: 1120,
    cooldown: 30,
    skillFamily: 'Glyph',
    implemented: true,
    effects: elementalistPacketEffects(
      [
        [1600, 0.8],
        [1920, 0.72],
        [2240, 0.64],
        [2560, 0.56],
        [2880, 0.48],
        [3200, 0.4],
        [3520, 0.32],
        [3840, 0.32],
        [4160, 0.32],
        [4480, 0.32],
        [4800, 0.32],
        [5120, 0.32],
        [5440, 0.32],
        [5760, 0.32],
        [6080, 0.32],
        [6400, 0.32],
        [6720, 0.32],
        [7040, 0.32]
      ],
      { condition: { condition: 'Chilled', stacks: 1, duration: 3 } }
    )
  },
  [ID.GLYPH_OF_STORMS_AIR]: {
    name: 'Glyph of Storms (Air)',
    type: 'Utility',
    slot: 'Utility',
    attunement: 'Air',
    categories: ['Glyph'],
    quicknessCastTimeMs: 1120,
    cooldown: 60,
    skillFamily: 'Glyph',
    implemented: true,
    effects: elementalistPacketEffects(
      [
        [880, 0.825],
        [880, 0.78375],
        [880, 0.7425],
        [1400, 0.70125],
        [1560, 0.66],
        [1680, 0.61875],
        [1890, 0.5775],
        [2200, 0.53625],
        [2400, 0.495],
        [2480, 0.45375],
        [2840, 0.4125],
        [2880, 0.37125],
        [3280, 0.33],
        [3400, 0.28875],
        [3480, 0.2475],
        [3880, 0.2475],
        [4080, 0.2475],
        [4160, 0.2475],
        [4400, 0.2475],
        [4800, 0.2475],
        [4880, 0.2475],
        [4880, 0.2475],
        [5400, 0.2475],
        [5440, 0.2475],
        [5680, 0.2475],
        [5880, 0.2475],
        [6080, 0.2475],
        [6400, 0.2475],
        [6480, 0.2475],
        [6760, 0.2475],
        [7290, 0.2475],
        [7400, 0.2475],
        [8040, 0.2475],
        [8080, 0.2475],
        [8880, 0.2475],
        [9680, 0.2475]
      ],
      { condition: { condition: 'Vulnerability', stacks: 2, duration: 8 } }
    )
  },
  [ID.GLYPH_OF_STORMS_EARTH]: {
    name: 'Glyph of Storms (Earth)',
    type: 'Utility',
    slot: 'Utility',
    attunement: 'Earth',
    categories: ['Glyph'],
    quicknessCastTimeMs: 1120,
    cooldown: 40,
    skillFamily: 'Glyph',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: GLYPH_OF_STORMS_FIRE_EARTH_TICK_OFFSETS_MS.map((atMs) => ({
          atMs,
          coefficient: 0.045454545454545456,
          metadata: {
            damageKind: 'field-tick'
          }
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: GLYPH_OF_STORMS_FIRE_EARTH_TICK_OFFSETS_MS.map((atMs) => ({
          atMs,
          condition: 'Bleeding',
          stacks: 1,
          duration: 3
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'blind',
        atMs: 880,
        applications: 11,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'blind'
        }
      }
    ]
  },
  [ID.SIGNET_OF_FIRE]: {
    name: 'Signet of Fire',
    type: 'Utility',
    slot: 'Utility',
    categories: ['Signet'],
    quicknessCastTimeMs: 520,
    cooldown: 12,
    skillFamily: 'Signet',
    implemented: true,
    // Activating the signet disables its passive until recharge unless Written in Stone preserves it.
    mechanicTriggers: [
      {
        type: 'elementalist.core.disable-signet-of-fire-passive',
        timingAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 440,
            coefficient: 0.5
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
            stacks: 2,
            duration: 10
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.SIGNET_OF_EARTH]: {
    name: 'Signet of Earth',
    type: 'Utility',
    slot: 'Utility',
    categories: ['Signet'],
    quicknessCastTimeMs: 520,
    cooldown: 15,
    skillFamily: 'Signet',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 440,
            coefficient: 0.5
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
            condition: 'Bleeding',
            stacks: 4,
            duration: 9
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
            atMs: 440,
            condition: 'Immobilize',
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
  [ID.CONJURE_FIERY_GREATSWORD]: {
    name: 'Conjure Fiery Greatsword',
    type: 'Elite',
    slot: 'Elite',
    categories: ['Conjure'],
    quicknessCastTimeMs: 1160,
    cooldown: 180,
    skillFamily: 'Conjure',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1440,
            coefficient: 1
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 1440,
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
  [ID.FLAME_WAVE]: {
    name: 'Flame Wave',
    type: 'Weapon',
    slot: 'Weapon_1',
    skillWeapon: 'Fiery Greatsword',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 2160,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    implemented: true,
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
  [ID.FIERY_ERUPTION]: {
    name: 'Fiery Eruption',
    type: 'Weapon',
    slot: 'Weapon_2',
    skillWeapon: 'Fiery Greatsword',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 720,
    cooldown: 5,
    skillFamily: 'Weapon skill',
    implemented: true,
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
  [ID.FIERY_WHIRL]: {
    name: 'Fiery Whirl',
    type: 'Weapon',
    slot: 'Weapon_3',
    skillWeapon: 'Fiery Greatsword',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 1320,
    cooldown: 5,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: elementalistPacketEffects(
      [
        [280, 0.688],
        [400, 0.688],
        [530, 0.688],
        [640, 0.688],
        [760, 0.688],
        [880, 0.688],
        [990, 0.688],
        [1130, 0.688]
      ],
      {
        condition: { condition: 'Cripple', stacks: 1, duration: 3 },
        strikeTick: {
          comboFinishers: [
            {
              ownerId: 'elementalist',
              finisherType: 'Whirl',
              ambiguousFieldSelection: 'oldest'
            }
          ],
          metadata: {}
        }
      }
    )
  },
  [ID.FIERY_RUSH]: {
    name: 'Fiery Rush',
    type: 'Weapon',
    slot: 'Weapon_4',
    skillWeapon: 'Fiery Greatsword',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 1280,
    cooldown: 10,
    skillFamily: 'Weapon skill',
    implemented: true,
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
  [ID.FIRESTORM]: {
    name: 'Firestorm',
    type: 'Weapon',
    slot: 'Weapon_5',
    skillWeapon: 'Fiery Greatsword',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 760,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: FIRESTORM_TICK_OFFSETS_MS.map((atMs) => ({
          atMs,
          coefficient: 0.65
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.GLYPH_OF_ELEMENTALS]: {
    name: 'Glyph of Elementals',
    type: 'Elite',
    slot: 'Elite',
    categories: ['Glyph'],
    quicknessCastTimeMs: 0,
    cooldown: 190,
    skillFamily: 'Glyph',
    implemented: true,
    effects: [],
    elementalistStateMachine: 'summoned-elemental'
  },
  [ID.GLYPH_OF_ELEMENTALS_EARTH]: {
    name: 'Glyph of Elementals (Earth)',
    type: 'Elite',
    slot: 'Elite',
    categories: ['Glyph'],
    quicknessCastTimeMs: 0,
    cooldown: 190,
    skillFamily: 'Glyph',
    implemented: true,
    effects: [],
    elementalistStateMachine: 'summoned-elemental'
  },
  [ID.DODGE]: {
    name: 'Dodge',
    type: 'Action',
    slot: 'Action',
    categories: ['Dodge'],
    castTimeMs: 800,
    unaffectedByQuickness: true,
    cooldown: 0,
    skillFamily: 'Dodge',
    implemented: true,
    effects: []
  },
  [ID.FLAME_BURST_TRAIT]: {
    name: 'Flame Burst (trait)',
    type: 'Action',
    slot: 'Action',
    categories: ['Trait'],
    quicknessCastTimeMs: 0,
    cooldown: 10,
    simulatorExcluded: true,
    slotSelectable: false,
    skillFamily: 'Trait',
    implemented: false,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 1
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 0,
            condition: 'Burning',
            stacks: 3,
            duration: 6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.CLEANSING_WAVE_TRAIT]: {
    name: 'Cleansing Wave (trait)',
    type: 'Action',
    slot: 'Action',
    categories: ['Trait'],
    quicknessCastTimeMs: 0,
    cooldown: 10,
    simulatorExcluded: true,
    slotSelectable: false,
    skillFamily: 'Trait',
    implemented: false,
    effects: []
  },
  [ID.BLINDING_FLASH_TRAIT]: {
    name: 'Blinding Flash (trait)',
    type: 'Action',
    slot: 'Action',
    categories: ['Trait'],
    quicknessCastTimeMs: 0,
    cooldown: 10,
    simulatorExcluded: true,
    slotSelectable: false,
    skillFamily: 'Trait',
    implemented: false,
    effects: [
      {
        type: 'blind',
        atMs: 0,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'blind'
        }
      }
    ]
  },
  [ID.SHOCK_WAVE_TRAIT]: {
    name: 'Shock Wave (trait)',
    type: 'Action',
    slot: 'Action',
    categories: ['Trait'],
    quicknessCastTimeMs: 0,
    cooldown: 10,
    simulatorExcluded: true,
    slotSelectable: false,
    skillFamily: 'Trait',
    implemented: false,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 0.5,
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
            atMs: 0,
            condition: 'Bleeding',
            stacks: 1,
            duration: 20
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
            atMs: 0,
            condition: 'Cripple',
            stacks: 1,
            duration: 2
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.CLEANSING_FIRE]: {
    name: 'Cleansing Fire',
    type: 'Utility',
    slot: 'Utility',
    categories: ['Cantrip'],
    quicknessCastTimeMs: 0,
    cooldown: 20,
    skillFamily: 'Cantrip',
    implemented: true,
    effects: [
      {
        type: 'condition',
        ticks: [
          {
            atMs: 0,
            condition: 'Burning',
            stacks: 2,
            duration: 6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'boon',
        boon: 'Might',
        stacks: 3,
        duration: 9,
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  }
});

const CONJURE_ACTION_ICONS = Object.freeze({
  'Frost Bow': 'https://render.guildwars2.com/file/CC6D556B7C3F95C49E54D697CC2B4E79105DC594/103348.png',
  'Lightning Hammer': 'https://render.guildwars2.com/file/C3DA6AC980062B0A0EEA14CE51393748CFAE01CA/103369.png',
  'Fiery Greatsword': 'https://render.guildwars2.com/file/EEDA0B1847077DE93DBB0575D44BE0615FBCE728/103328.png'
});

export const ELEMENTALIST_CORE_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
  {
    id: ID.FLAME_BARRAGE_ELEMENTAL_COMMAND,
    name: 'Flame Barrage',
    displayName: 'Flame Barrage',
    description: 'Command your summoned Fire Elemental to unleash a flame barrage.',
    icon: 'https://render.guildwars2.com/file/64A5054179704B60614F90964DE1FB3D39AEC972/867446.png',
    type: 'Elite',
    weapon: '',
    slot: 'Elite',
    specialization: '',
    categories: ['Glyph', 'Elemental command'],
    cooldown: 15,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null,
    flipParentId: ID.GLYPH_OF_ELEMENTALS,
    flipParent: 'Glyph of Elementals',
    castTimeMs: 0,
    slotSelectable: false,
    implemented: true,
    simulatorExcluded: false,
    effects: []
  },
  {
    id: ID.STOMP_ELEMENTAL_COMMAND,
    name: 'Stomp',
    displayName: 'Stomp',
    description:
      'Command your summoned Earth Elemental to stomp, granting Protection to allies and crippling and immobilizing nearby foes.',
    icon: 'https://render.guildwars2.com/file/A39EBFA9E241DDBF6EEFBEC515192F32F5F2A620/867445.png',
    type: 'Elite',
    weapon: '',
    slot: 'Elite',
    specialization: '',
    categories: ['Glyph', 'Elemental command'],
    cooldown: 18,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null,
    flipParentId: ID.GLYPH_OF_ELEMENTALS_EARTH,
    flipParent: 'Glyph of Elementals (Earth)',
    castTimeMs: 0,
    slotSelectable: false,
    implemented: true,
    simulatorExcluded: false,
    effects: []
  },
  {
    id: ID.DROP_BUNDLE,
    name: '__drop_bundle',
    displayName: 'Drop Bundle',
    description: 'Drop the currently equipped conjured weapon.',
    icon: 'https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png',
    type: 'Action',
    weapon: '',
    slot: 'Action',
    specialization: '',
    categories: ['Bundle'],
    cooldown: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null,
    castTimeMs: 0,
    implemented: true,
    simulatorExcluded: false,
    paletteAction: false,
    effects: []
  },
  ...[
    ['Frost Bow', ID.PICK_UP_FROST_BOW],
    ['Lightning Hammer', ID.PICK_UP_LIGHTNING_HAMMER],
    ['Fiery Greatsword', ID.PICK_UP_FIERY_GREATSWORD]
  ].map(([weapon, id]): Skill => ({
    id: Number(id),
    name: `__pickup_${weapon}`,
    displayName: `Pick up ${weapon}`,
    description: `Pick up the available ${weapon}.`,
    icon: CONJURE_ACTION_ICONS[weapon as keyof typeof CONJURE_ACTION_ICONS],
    type: 'Action',
    weapon: '',
    slot: 'Action',
    specialization: '',
    categories: ['Bundle'],
    cooldown: 0,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null,
    castTimeMs: 300,
    unaffectedByQuickness: true,
    implemented: true,
    simulatorExcluded: false,
    paletteAction: false,
    effects: []
  }))
]);
