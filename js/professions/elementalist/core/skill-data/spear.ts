/** Spear weapon-skill mechanics owned by the Core Elementalist module. */

import { ELEMENTALIST_SKILL_IDS as ID } from '../../data/ids.js';
import type { SkillFragment } from '../../../../platform/engine/types.js';

export const ELEMENTALIST_CORE_SPEAR_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.FLAME_SPEAR]: {
    name: 'Flame Spear',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Spear',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 640,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 520,
            coefficient: 1.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.BLAZING_BARRAGE]: {
    name: 'Blazing Barrage',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Spear',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 560,
    cooldown: 6,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 440,
            coefficient: 2.6,
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
            atMs: 440,
            condition: 'Burning',
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
  [ID.SEETHE]: {
    name: 'Seethe',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Spear',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 360,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    implemented: true,
    // Seethe empowers the next qualifying spear hit after completion.
    mechanicTriggers: [
      {
        type: 'elementalist.core.arm-spear-damage',
        timingAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'boon',
        boon: 'Fury',
        stacks: 1,
        duration: 4,
        durationScale: 'boon',
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'boon',
        boon: 'Might',
        stacks: 5,
        duration: 10,
        durationScale: 'boon',
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    elementalistStateMachine: 'spear-followup'
  },
  [ID.METEOR]: {
    name: 'Meteor',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Spear',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 680,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 560,
            coefficient: 3.375
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.ETCHING_VOLCANO]: {
    name: 'Etching: Volcano',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Spear',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 240,
    cooldown: 25,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Fire',
        duration: 7,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'boon',
        boon: 'Might',
        stacks: 1,
        duration: 8,
        durationScale: 'boon',
        atMs: 240,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    elementalistStateMachine: 'spear-etching'
  },
  [ID.LESSER_VOLCANO]: {
    name: 'Lesser Volcano',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Spear',
    attunement: 'Fire',
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
            atMs: 1520,
            coefficient: 0.63
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1800,
            coefficient: 0.567
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 2060,
            coefficient: 0.504
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 2360,
            coefficient: 0.441
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 2640,
            coefficient: 0.378
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 2920,
            coefficient: 0.315
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    elementalistStateMachine: 'spear-etching'
  },
  [ID.VOLCANO]: {
    name: 'Volcano',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Spear',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 600,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          [1560, 1.21],
          [1800, 1.089],
          [2120, 0.968],
          [2400, 0.847],
          [2640, 0.726],
          [2920, 0.605],
          [3240, 0.484],
          [3480, 0.363],
          [3760, 0.242],
          [4040, 0.121],
          [4320, 0.05],
          [4640, 0.05]
        ].map(([atMs, coefficient]) => ({ atMs, coefficient })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    elementalistStateMachine: 'spear-etching'
  },
  [ID.RESTORATIVE_SPEAR]: {
    name: 'Restorative Spear',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Spear',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 640,
    cooldown: 0,
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
      }
    ]
  },
  [ID.ICE_BEAM]: {
    name: 'Ice Beam',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Spear',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 840,
    cooldown: 6,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 360,
            coefficient: 0.7
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
            condition: 'Chilled',
            stacks: 1,
            duration: 1
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
            coefficient: 0.7
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
            condition: 'Chilled',
            stacks: 1,
            duration: 1
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
            atMs: 720,
            coefficient: 0.7
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
  [ID.RIPPLE]: {
    name: 'Ripple',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Spear',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 800,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    implemented: true,
    // Ripple empowers the next qualifying spear recharge after completion.
    mechanicTriggers: [
      {
        type: 'elementalist.core.arm-spear-recharge',
        timingAnchor: 'castEnd'
      }
    ],
    effects: [],
    elementalistStateMachine: 'spear-followup'
  },
  [ID.UNDERTOW]: {
    name: 'Undertow',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Spear',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 600,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 480,
            coefficient: 1.7
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        canCrit: true
      },
      {
        type: 'control',
        atMs: 480,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'crowd-control'
        }
      }
    ]
  },
  [ID.ETCHING_JO_KULHLAUP]: {
    name: 'Etching: Jökulhlaup',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Spear',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 240,
    cooldown: 25,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Water',
        duration: 7,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [],
    elementalistStateMachine: 'spear-etching'
  },
  [ID.LESSER_JO_KULHLAUP]: {
    name: 'Lesser Jökulhlaup',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Spear',
    attunement: 'Water',
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
            coefficient: 1.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    elementalistStateMachine: 'spear-etching'
  },
  [ID.JO_KULHLAUP]: {
    name: 'Jökulhlaup',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Spear',
    attunement: 'Water',
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
            coefficient: 3
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    elementalistStateMachine: 'spear-etching'
  },
  [ID.LIGHTNING_JAVELIN]: {
    name: 'Lightning Javelin',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Spear',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 640,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 520,
            coefficient: 1.35
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
            condition: 'Vulnerability',
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
  [ID.FULGOR]: {
    name: 'Fulgor',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Spear',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 560,
    cooldown: 6,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 480,
            coefficient: 0.4
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
            condition: 'Vulnerability',
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
            atMs: 1480,
            coefficient: 0.4
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 1480,
            condition: 'Vulnerability',
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
            atMs: 2480,
            coefficient: 0.4
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 2480,
            condition: 'Vulnerability',
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
            atMs: 3480,
            coefficient: 0.4
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 3480,
            condition: 'Vulnerability',
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
            atMs: 4480,
            coefficient: 0.4
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 4480,
            condition: 'Vulnerability',
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
  [ID.ENERGIZE]: {
    name: 'Energize',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Spear',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    implemented: true,
    // Energize guarantees the next qualifying spear critical hit after completion.
    mechanicTriggers: [
      {
        type: 'elementalist.core.arm-spear-critical',
        timingAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'boon',
        boon: 'Superspeed',
        stacks: 1,
        duration: 4,
        durationScale: 'boon',
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    elementalistStateMachine: 'spear-followup'
  },
  [ID.TWISTER]: {
    name: 'Twister',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Spear',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 600,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 520,
            coefficient: 1.84,
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
        type: 'condition',
        ticks: [
          {
            atMs: 520,
            condition: 'Vulnerability',
            stacks: 10,
            duration: 10
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'control',
        atMs: 520,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'crowd-control'
        }
      }
    ]
  },
  [ID.ETCHING_DERECHO]: {
    name: 'Etching: Derecho',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Spear',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 240,
    cooldown: 25,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Lightning',
        duration: 7,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'boon',
        boon: 'Fury',
        stacks: 1,
        duration: 7,
        durationScale: 'boon',
        atMs: 240,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    elementalistStateMachine: 'spear-etching'
  },
  [ID.LESSER_DERECHO]: {
    name: 'Lesser Derecho',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Spear',
    attunement: 'Air',
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
            coefficient: 2
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        canCrit: true
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
    ],
    elementalistStateMachine: 'spear-etching'
  },
  [ID.DERECHO]: {
    name: 'Derecho',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Spear',
    attunement: 'Air',
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
            coefficient: 4
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        canCrit: true
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
    ],
    elementalistStateMachine: 'spear-etching'
  },
  [ID.STONE_STRIKE]: {
    name: 'Stone Strike',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Spear',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 640,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 520,
            coefficient: 1.2
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
            duration: 5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.EARTHEN_SPEAR]: {
    name: 'Earthen Spear',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Spear',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 680,
    cooldown: 6,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 600,
            coefficient: 3,
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
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 600,
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
  [ID.HARDEN]: {
    name: 'Harden',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Spear',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 200,
    cooldown: 15,
    skillFamily: 'Weapon skill',
    implemented: true,
    // Harden adds control to the next qualifying spear hit after completion.
    mechanicTriggers: [
      {
        type: 'elementalist.core.arm-spear-control',
        timingAnchor: 'castEnd'
      }
    ],
    effects: [],
    elementalistStateMachine: 'spear-followup'
  },
  [ID.FISSURE]: {
    name: 'Fissure',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Spear',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 680,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 560,
            coefficient: 3.375
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 560,
            condition: 'Weakness',
            stacks: 1,
            duration: 4
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
            atMs: 560,
            condition: 'Cripple',
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
  [ID.ETCHING_HABOOB]: {
    name: 'Etching: Haboob',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Spear',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 240,
    cooldown: 25,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Dark',
        duration: 7,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [],
    elementalistStateMachine: 'spear-etching'
  },
  [ID.LESSER_HABOOB]: {
    name: 'Lesser Haboob',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Spear',
    attunement: 'Earth',
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
            coefficient: 1.75
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'blind',
        atMs: 560,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'blind'
        }
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 560,
            condition: 'Cripple',
            stacks: 1,
            duration: 5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    elementalistStateMachine: 'spear-etching'
  },
  [ID.HABOOB]: {
    name: 'Haboob',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Spear',
    attunement: 'Earth',
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
            coefficient: 4.25
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'blind',
        atMs: 560,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'blind'
        }
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 560,
            condition: 'Vulnerability',
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
            atMs: 560,
            condition: 'Weakness',
            stacks: 1,
            duration: 4
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
            atMs: 560,
            condition: 'Cripple',
            stacks: 1,
            duration: 55
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    elementalistStateMachine: 'spear-etching'
  }
});
