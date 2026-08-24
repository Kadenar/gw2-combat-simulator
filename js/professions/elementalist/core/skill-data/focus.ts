/** Focus weapon-skill mechanics owned by the Core Elementalist module. */

import { ELEMENTALIST_SKILL_IDS as ID } from '../../data/ids.js';
import type { SkillFragment } from '../../../../platform/engine/types.js';

const FLAMEWALL_TICK_OFFSETS_MS = [560, 1560, 2560, 3560, 4560, 5560, 6560, 7560, 8560] as const;

export const ELEMENTALIST_CORE_FOCUS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.FLAMEWALL]: {
    name: 'Flamewall',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Focus',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 560,
    cooldown: 20,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Fire',
        duration: 9,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: FLAMEWALL_TICK_OFFSETS_MS.map((atMs) => ({
          atMs,
          coefficient: 0.1,
          metadata: {
            damageKind: 'field-tick'
          }
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: FLAMEWALL_TICK_OFFSETS_MS.map((atMs) => ({
          atMs,
          condition: 'Burning',
          stacks: 1,
          duration: 2.5
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.FIRE_SHIELD]: {
    name: 'Fire Shield',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Focus',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 25,
    nextChainId: ID.TRANSMUTE_FIRE,
    aura: 'Fire|4',
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: []
  },
  [ID.TRANSMUTE_FIRE]: {
    name: 'Transmute Fire',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Focus',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 360,
    cooldown: 10,
    nextChainId: ID.FIRE_SHIELD,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 840,
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
            atMs: 840,
            condition: 'Burning',
            stacks: 1,
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
        stacks: 5,
        duration: 6,
        atMs: 840,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    elementalistStateMachine: 'aura-transmute'
  },
  [ID.FREEZING_GUST]: {
    name: 'Freezing Gust',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Focus',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 440,
    cooldown: 25,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 280,
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
            atMs: 280,
            condition: 'Chilled',
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
  [ID.COMET]: {
    name: 'Comet',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Focus',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 680,
    cooldown: 25,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 760,
            coefficient: 0.75,
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
        atMs: 760,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'crowd-control'
        }
      }
    ]
  },
  [ID.SWIRLING_WINDS]: {
    name: 'Swirling Winds',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Focus',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 680,
    cooldown: 30,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: []
  },
  [ID.GALE]: {
    name: 'Gale',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Focus',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 560,
    cooldown: 40,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'control',
        atMs: 560,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'crowd-control'
        }
      }
    ]
  },
  [ID.MAGNETIC_WAVE]: {
    name: 'Magnetic Wave',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Focus',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 25,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 1,
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
            condition: 'Cripple',
            stacks: 1,
            duration: 5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.OBSIDIAN_FLESH]: {
    name: 'Obsidian Flesh',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Focus',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 3800,
    cooldown: 50,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: []
  }
});
