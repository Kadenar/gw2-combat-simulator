/** Warhorn weapon-skill mechanics owned by the Core Elementalist module. */

import { ELEMENTALIST_SKILL_IDS as ID } from '../../data/ids.js';
import { elementalistPacketEffects } from '../skill-effects.js';
import type { SkillFragment } from '../../../../platform/engine/types.js';

const WILDFIRE_TICK_OFFSETS_MS = [1560, 2560, 3560, 4560, 5560, 6560, 7560] as const;

const DUST_STORM_TICK_OFFSETS_MS = [1560, 2640, 3560, 4640, 5560, 6640, 7560, 8640] as const;

export const ELEMENTALIST_CORE_WARHORN_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.HEAT_SYNC]: {
    name: 'Heat Sync',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Warhorn',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 840,
    cooldown: 30,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'boon',
        boon: 'Fury',
        stacks: 1,
        duration: 10,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'boon',
        boon: 'Might',
        stacks: 3,
        duration: 10,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.WILDFIRE]: {
    name: 'Wildfire',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Warhorn',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 660,
    cooldown: 30,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Fire',
        duration: 8,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: WILDFIRE_TICK_OFFSETS_MS.map((atMs) => ({
          atMs,
          coefficient: 0.44,
          metadata: {
            damageKind: 'field-tick'
          }
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: WILDFIRE_TICK_OFFSETS_MS.map((atMs) => ({
          atMs,
          condition: 'Burning',
          stacks: 1,
          duration: 3
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.TIDAL_SURGE]: {
    name: 'Tidal Surge',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Warhorn',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 440,
    cooldown: 30,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 920,
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
        timingScale: 'cast',
        canCrit: true
      },
      {
        type: 'control',
        atMs: 920,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'crowd-control'
        }
      }
    ]
  },
  [ID.WATER_GLOBE]: {
    name: 'Water Globe',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Warhorn',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 840,
    cooldown: 30,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Water',
        duration: 4,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: []
  },
  [ID.CYCLONE]: {
    name: 'Cyclone',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Warhorn',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 800,
    cooldown: 25,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 560,
            coefficient: 0.9
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        canCrit: true
      },
      {
        type: 'boon',
        boon: 'Swiftness',
        stacks: 1,
        duration: 10,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'buff',
        kind: 'superspeed',
        stacks: 1,
        duration: 2.5,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
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
  [ID.LIGHTNING_ORB]: {
    name: 'Lightning Orb',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Warhorn',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 440,
    cooldown: 25,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: elementalistPacketEffects(
      [
        [400, 0.8],
        [680, 0.72],
        [960, 0.64],
        [1240, 0.56],
        [1520, 0.48],
        [1800, 0.4],
        [2080, 0.32],
        [2360, 0.24],
        [2760, 0.16],
        [3160, 0.08],
        [3600, 0.05],
        [4000, 0.05],
        [4400, 0.05],
        [4800, 0.05],
        [4800, 0.05],
        [5060, 0.05],
        [5390, 0.05],
        [5790, 0.05],
        [6220, 0.05],
        [6620, 0.05]
      ],
      { condition: { condition: 'Vulnerability', stacks: 1, duration: 10 } }
    )
  },
  [ID.SAND_SQUALL]: {
    name: 'Sand Squall',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Warhorn',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 840,
    cooldown: 30,
    aura: 'Magnetic|4',
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'boon',
        boon: 'Protection',
        stacks: 1,
        duration: 2,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.DUST_STORM]: {
    name: 'Dust Storm',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Warhorn',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 840,
    cooldown: 30,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: DUST_STORM_TICK_OFFSETS_MS.map((atMs) => ({
          atMs,
          coefficient: 0.3
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: DUST_STORM_TICK_OFFSETS_MS.map((atMs) => ({
          atMs,
          condition: 'Bleeding',
          stacks: 2,
          duration: 10
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      ...DUST_STORM_TICK_OFFSETS_MS.map((atMs) => ({
        type: 'blind' as const,
        atMs,
        applications: 1,
        timingAnchor: 'castStart' as const,
        timingScale: 'cast' as const,
        metadata: {
          controlKind: 'blind'
        }
      })),
      {
        type: 'boon',
        boon: 'Resistance',
        stacks: 1,
        duration: 4,
        atMs: 1560,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  }
});
