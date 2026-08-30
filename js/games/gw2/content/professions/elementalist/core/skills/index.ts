/** Core Elementalist skill mechanics. */
import { ELEMENTALIST_SKILL_IDS as ID } from '../../data/ids.js';
import { conditionTimeline, strikeTimeline } from '../../../../../platform/engine/effects/factories.js';
import type { Skill, SkillFragment } from '../../../../../platform/engine/types.js';
import { ELEMENTALIST_CORE_DAGGER_SKILL_MECHANICS } from './weapons/dagger.js';
import { ELEMENTALIST_CORE_FOCUS_SKILL_MECHANICS } from './weapons/focus.js';
import { ELEMENTALIST_CORE_HAMMER_SKILL_MECHANICS } from './weapons/hammer.js';
import { ELEMENTALIST_CORE_PISTOL_SKILL_MECHANICS } from './weapons/pistol.js';
import { ELEMENTALIST_CORE_SCEPTER_SKILL_MECHANICS } from './weapons/scepter.js';
import { ELEMENTALIST_CORE_SPEAR_SKILL_MECHANICS } from './weapons/spear.js';
import { ELEMENTALIST_CORE_STAFF_SKILL_MECHANICS } from './weapons/staff.js';
import { ELEMENTALIST_CORE_SWORD_SKILL_MECHANICS } from './weapons/sword.js';
import { ELEMENTALIST_CORE_WARHORN_SKILL_MECHANICS } from './weapons/warhorn.js';

// Cast-scaled packet data is authored on the Quickness timeline and expands only for slower casts.
const CAST_SCALED_PACKET_TIMING = {
  timingAnchor: 'castStart',
  timingScale: 'cast'
} as const;

// Canonical tick timelines keep packet coefficients and same-time strike order explicit in skill data.
const FROST_STORM_STRIKE_TICKS = [
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
] as const;

const INVOKE_LIGHTNING_STRIKE_TICKS = [
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
] as const;

const GLYPH_OF_STORMS_WATER_STRIKE_TICKS = [
  { atMs: 1600, coefficient: 0.8 },
  { atMs: 1920, coefficient: 0.72 },
  { atMs: 2240, coefficient: 0.64 },
  { atMs: 2560, coefficient: 0.56 },
  { atMs: 2880, coefficient: 0.48 },
  { atMs: 3200, coefficient: 0.4 },
  { atMs: 3520, coefficient: 0.32 },
  { atMs: 3840, coefficient: 0.32 },
  { atMs: 4160, coefficient: 0.32 },
  { atMs: 4480, coefficient: 0.32 },
  { atMs: 4800, coefficient: 0.32 },
  { atMs: 5120, coefficient: 0.32 },
  { atMs: 5440, coefficient: 0.32 },
  { atMs: 5760, coefficient: 0.32 },
  { atMs: 6080, coefficient: 0.32 },
  { atMs: 6400, coefficient: 0.32 },
  { atMs: 6720, coefficient: 0.32 },
  { atMs: 7040, coefficient: 0.32 }
] as const;

// Layers interleave same-time Vulnerability after its originating hit without reverting to per-packet effects.
const GLYPH_OF_STORMS_AIR_STRIKE_TICK_LAYERS = [
  [
    { atMs: 880, coefficient: 0.825 },
    { atMs: 1400, coefficient: 0.70125 },
    { atMs: 1560, coefficient: 0.66 },
    { atMs: 1680, coefficient: 0.61875 },
    { atMs: 1890, coefficient: 0.5775 },
    { atMs: 2200, coefficient: 0.53625 },
    { atMs: 2400, coefficient: 0.495 },
    { atMs: 2480, coefficient: 0.45375 },
    { atMs: 2840, coefficient: 0.4125 },
    { atMs: 2880, coefficient: 0.37125 },
    { atMs: 3280, coefficient: 0.33 },
    { atMs: 3400, coefficient: 0.28875 },
    { atMs: 3480, coefficient: 0.2475 },
    { atMs: 3880, coefficient: 0.2475 },
    { atMs: 4080, coefficient: 0.2475 },
    { atMs: 4160, coefficient: 0.2475 },
    { atMs: 4400, coefficient: 0.2475 },
    { atMs: 4800, coefficient: 0.2475 },
    { atMs: 4880, coefficient: 0.2475 },
    { atMs: 5400, coefficient: 0.2475 },
    { atMs: 5440, coefficient: 0.2475 },
    { atMs: 5680, coefficient: 0.2475 },
    { atMs: 5880, coefficient: 0.2475 },
    { atMs: 6080, coefficient: 0.2475 },
    { atMs: 6400, coefficient: 0.2475 },
    { atMs: 6480, coefficient: 0.2475 },
    { atMs: 6760, coefficient: 0.2475 },
    { atMs: 7290, coefficient: 0.2475 },
    { atMs: 7400, coefficient: 0.2475 },
    { atMs: 8040, coefficient: 0.2475 },
    { atMs: 8080, coefficient: 0.2475 },
    { atMs: 8880, coefficient: 0.2475 },
    { atMs: 9680, coefficient: 0.2475 }
  ],
  [
    { atMs: 880, coefficient: 0.78375 },
    { atMs: 4880, coefficient: 0.2475 }
  ],
  [{ atMs: 880, coefficient: 0.7425 }]
] as const;

const FIERY_WHIRL_STRIKE_TICKS = [
  { atMs: 280, coefficient: 0.688 },
  { atMs: 400, coefficient: 0.688 },
  { atMs: 530, coefficient: 0.688 },
  { atMs: 640, coefficient: 0.688 },
  { atMs: 760, coefficient: 0.688 },
  { atMs: 880, coefficient: 0.688 },
  { atMs: 990, coefficient: 0.688 },
  { atMs: 1130, coefficient: 0.688 }
] as const;
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
    effects: [
      strikeTimeline(FROST_STORM_STRIKE_TICKS, CAST_SCALED_PACKET_TIMING),
      conditionTimeline(
        FROST_STORM_STRIKE_TICKS.slice(1).map(({ atMs }) => ({
          atMs,
          condition: 'Bleeding',
          stacks: 1,
          duration: 3
        })),
        CAST_SCALED_PACKET_TIMING
      )
    ]
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
    effects: [strikeTimeline(INVOKE_LIGHTNING_STRIKE_TICKS, CAST_SCALED_PACKET_TIMING)]
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
    effects: [
      strikeTimeline(GLYPH_OF_STORMS_WATER_STRIKE_TICKS, CAST_SCALED_PACKET_TIMING),
      conditionTimeline(
        GLYPH_OF_STORMS_WATER_STRIKE_TICKS.map(({ atMs }) => ({
          atMs,
          condition: 'Chilled',
          stacks: 1,
          duration: 3
        })),
        CAST_SCALED_PACKET_TIMING
      )
    ]
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
    effects: GLYPH_OF_STORMS_AIR_STRIKE_TICK_LAYERS.flatMap((ticks) => [
      strikeTimeline(ticks, CAST_SCALED_PACKET_TIMING),
      conditionTimeline(
        ticks.map(({ atMs }) => ({
          atMs,
          condition: 'Vulnerability',
          stacks: 2,
          duration: 8
        })),
        CAST_SCALED_PACKET_TIMING
      )
    ])
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
    effects: [
      strikeTimeline(FIERY_WHIRL_STRIKE_TICKS, {
        ...CAST_SCALED_PACKET_TIMING,
        comboFinishers: [
          {
            ownerId: 'elementalist',
            finisherType: 'Whirl',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      }),
      conditionTimeline(
        FIERY_WHIRL_STRIKE_TICKS.map(({ atMs }) => ({
          atMs,
          condition: 'Cripple',
          stacks: 1,
          duration: 3
        })),
        CAST_SCALED_PACKET_TIMING
      )
    ]
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
