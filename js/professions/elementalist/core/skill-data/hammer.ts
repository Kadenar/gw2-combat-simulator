/** Hammer weapon-skill mechanics owned by the Core Elementalist module. */

import { ELEMENTALIST_SKILL_IDS as ID } from '../../data/ids.js';
import { elementalistPacketEffects } from '../skill-effects.js';
import type { SkillFragment } from '../../../../platform/engine/types.js';

export const ELEMENTALIST_CORE_HAMMER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SINGEING_STRIKE]: {
    name: 'Singeing Strike',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Hammer',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 440,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 360,
            coefficient: 0.69
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
            condition: 'Burning',
            stacks: 1,
            duration: 1.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.SURGING_FLAMES]: {
    name: 'Surging Flames',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Hammer',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 880,
    cooldown: 8,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 600,
            coefficient: 2.07
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
            duration: 3
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.FLAME_WHEEL]: {
    name: 'Flame Wheel',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Hammer',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 18,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1000,
            coefficient: 0.001,
            metadata: {
              damageKind: 'field-tick'
            }
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 1000,
            condition: 'Burning',
            stacks: 1,
            duration: 0.75
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    elementalistStateMachine: 'hammer-orbs'
  },
  [ID.TRIPLE_SEAR]: {
    name: 'Triple Sear',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Hammer',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 560,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 520,
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
            atMs: 520,
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
            atMs: 520,
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
            atMs: 520,
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
            atMs: 520,
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
            atMs: 520,
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
  [ID.MOLTEN_END]: {
    name: 'Molten End',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Hammer',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 760,
    cooldown: 25,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 720,
            coefficient: 2.8,
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
        type: 'boon',
        boon: 'Fury',
        stacks: 1,
        duration: 10,
        atMs: 720,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'boon',
        boon: 'Might',
        stacks: 6,
        duration: 10,
        atMs: 720,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.STREAM_STRIKE]: {
    name: 'Stream Strike',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Hammer',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 480,
    cooldown: 0,
    nextChainId: ID.WATER_RUSH,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 360,
            coefficient: 0.575
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.WATER_RUSH]: {
    name: 'Water Rush',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Hammer',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 640,
    cooldown: 0,
    nextChainId: ID.CHILLING_CRACK,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 320,
            coefficient: 0.575
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.CHILLING_CRACK]: {
    name: 'Chilling Crack',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Hammer',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 440,
    cooldown: 0,
    nextChainId: ID.STREAM_STRIKE,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 320,
            coefficient: 1.38
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 320,
            condition: 'Chilled',
            stacks: 1,
            duration: 1.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.RAIN_OF_BLOWS]: {
    name: 'Rain of Blows',
    interruptMode: 'per-packet',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Hammer',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 920,
    cooldown: 6,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 320,
            coefficient: 0.575
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 480,
            coefficient: 0.575
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 720,
            coefficient: 0.575
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 880,
            coefficient: 0.575
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 880,
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
  [ID.ICY_COIL]: {
    name: 'Icy Coil',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Hammer',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 18,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1000,
            coefficient: 0.001,
            metadata: {
              damageKind: 'field-tick'
            }
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 1000,
            condition: 'Vulnerability',
            stacks: 1,
            duration: 6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    elementalistStateMachine: 'hammer-orbs'
  },
  [ID.CRASHING_FONT]: {
    name: 'Crashing Font',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Hammer',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 960,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 800,
            coefficient: 1.438,
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
      }
    ]
  },
  [ID.CLEANSING_TYPHOON]: {
    name: 'Cleansing Typhoon',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Hammer',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 480,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 400,
            coefficient: 1.725,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Whirl',
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
  [ID.WIND_SLAM]: {
    name: 'Wind Slam',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Hammer',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 680,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 560,
            coefficient: 1.036
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.HURRICANE_OF_PAIN]: {
    name: 'Hurricane of Pain',
    interruptMode: 'per-packet',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Hammer',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 2080,
    cooldown: 10,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: elementalistPacketEffects(
      [
        [200, 0.55],
        [360, 0.55],
        [600, 0.55],
        [840, 0.55],
        [1080, 0.55],
        [1320, 0.55],
        [1560, 0.55],
        [1800, 0.55],
        [2040, 0.55]
      ],
      { condition: { condition: 'Vulnerability', stacks: 1, duration: 10 } }
    )
  },
  [ID.CRESCENT_WIND]: {
    name: 'Crescent Wind',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Hammer',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 18,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1000,
            coefficient: 0.001,
            metadata: {
              damageKind: 'field-tick'
            }
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 1000,
            condition: 'Weakness',
            stacks: 1,
            duration: 1.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    elementalistStateMachine: 'hammer-orbs'
  },
  [ID.WIND_STORM]: {
    name: 'Wind Storm',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Hammer',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 440,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 440,
            coefficient: 0.3
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
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'control',
        atMs: 440,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'crowd-control'
        }
      }
    ]
  },
  [ID.SHOCK_BLAST]: {
    name: 'Shock Blast',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Hammer',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 280,
    cooldown: 25,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 280,
            coefficient: 0.575
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
            coefficient: 0.925,
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
  [ID.STONESTRIKE]: {
    name: 'Stonestrike',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Hammer',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 560,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 440,
            coefficient: 1.035
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.WHIRLING_STONES]: {
    name: 'Whirling Stones',
    interruptMode: 'per-packet',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Hammer',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 1440,
    cooldown: 8,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 520,
            coefficient: 0.84
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 520,
            condition: 'Bleeding',
            stacks: 1,
            duration: 6
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
            atMs: 760,
            coefficient: 0.84
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 760,
            condition: 'Bleeding',
            stacks: 1,
            duration: 6
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
            atMs: 960,
            coefficient: 0.84
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 960,
            condition: 'Bleeding',
            stacks: 1,
            duration: 6
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
            atMs: 1200,
            coefficient: 0.84
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 1200,
            condition: 'Bleeding',
            stacks: 1,
            duration: 6
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
            atMs: 1400,
            coefficient: 0.84
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 1400,
            condition: 'Bleeding',
            stacks: 1,
            duration: 6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.ROCKY_LOOP]: {
    name: 'Rocky Loop',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Hammer',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 18,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1000,
            coefficient: 0.001,
            metadata: {
              damageKind: 'field-tick'
            }
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 1000,
            condition: 'Bleeding',
            stacks: 1,
            duration: 2.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    elementalistStateMachine: 'hammer-orbs'
  },
  [ID.IMMUTABLE_STONE]: {
    name: 'Immutable Stone',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Hammer',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 1520,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: []
  },
  [ID.GROUND_POUND]: {
    name: 'Ground Pound',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Hammer',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 760,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 720,
            coefficient: 2.8,
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
            stacks: 5,
            duration: 6
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
  [ID.GRAND_FINALE]: {
    name: 'Grand Finale',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Hammer',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 680,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 680,
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
    ],
    elementalistStateMachine: 'hammer-orbs'
  }
});
