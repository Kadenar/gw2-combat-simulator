/** Staff weapon-skill mechanics owned by the Core Elementalist module. */

import { ELEMENTALIST_SKILL_IDS as ID } from '../../data/ids.js';
import { strikeTimeline } from '../../../../platform/engine/effects/factories.js';
import type { SkillFragment } from '../../../../platform/engine/types.js';

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

export const ELEMENTALIST_CORE_STAFF_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.FIREBALL]: {
    name: 'Fireball',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Staff',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 960,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 720,
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
            atMs: 720,
            condition: 'Burning',
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
  [ID.LAVA_FONT]: {
    name: 'Lava Font',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Staff',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 280,
    cooldown: 6,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Fire',
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
            atMs: 1160,
            coefficient: 0.525,
            metadata: {
              damageKind: 'field-tick'
            }
          },
          {
            atMs: 2160,
            coefficient: 0.525,
            metadata: {
              damageKind: 'field-tick'
            }
          },
          {
            atMs: 3160,
            coefficient: 0.525,
            metadata: {
              damageKind: 'field-tick'
            }
          },
          {
            atMs: 4160,
            coefficient: 0.525,
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
            atMs: 1160,
            condition: 'Burning',
            stacks: 1,
            duration: 1
          },
          {
            atMs: 2160,
            condition: 'Burning',
            stacks: 1,
            duration: 1
          },
          {
            atMs: 3160,
            condition: 'Burning',
            stacks: 1,
            duration: 1
          },
          {
            atMs: 4160,
            condition: 'Burning',
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
  [ID.FLAME_BURST]: {
    name: 'Flame Burst',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Staff',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 360,
    cooldown: 10,
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
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 320,
            condition: 'Burning',
            stacks: 3,
            duration: 6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
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
  [ID.BURNING_RETREAT]: {
    name: 'Burning Retreat',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Staff',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 1000,
    cooldown: 18,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Fire',
        duration: 6,
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
            atMs: 80,
            coefficient: 0.2
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 80,
            condition: 'Burning',
            stacks: 1,
            duration: 2
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
            atMs: 1080,
            coefficient: 0.2,
            metadata: {
              damageKind: 'field-tick'
            }
          },
          {
            atMs: 2080,
            coefficient: 0.2,
            metadata: {
              damageKind: 'field-tick'
            }
          },
          {
            atMs: 3080,
            coefficient: 0.2,
            metadata: {
              damageKind: 'field-tick'
            }
          },
          {
            atMs: 4080,
            coefficient: 0.2,
            metadata: {
              damageKind: 'field-tick'
            }
          },
          {
            atMs: 5080,
            coefficient: 0.2,
            metadata: {
              damageKind: 'field-tick'
            }
          },
          {
            atMs: 6080,
            coefficient: 0.2,
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
            atMs: 1080,
            condition: 'Burning',
            stacks: 1,
            duration: 2
          },
          {
            atMs: 2080,
            condition: 'Burning',
            stacks: 1,
            duration: 2
          },
          {
            atMs: 3080,
            condition: 'Burning',
            stacks: 1,
            duration: 2
          },
          {
            atMs: 4080,
            condition: 'Burning',
            stacks: 1,
            duration: 2
          },
          {
            atMs: 5080,
            condition: 'Burning',
            stacks: 1,
            duration: 2
          },
          {
            atMs: 6080,
            condition: 'Burning',
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
  [ID.METEOR_SHOWER]: {
    name: 'Meteor Shower',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Staff',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 2640,
    cooldown: 30,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      strikeTimeline(METEOR_SHOWER_STRIKE_TICKS, {
        timingAnchor: 'castStart',
        timingScale: 'cast'
      })
    ]
  },
  [ID.WATER_BLAST]: {
    name: 'Water Blast',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Staff',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 840,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    implemented: true,
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
  [ID.ICE_SPIKE]: {
    name: 'Ice Spike',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Staff',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 520,
    cooldown: 6,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1760,
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
        type: 'condition',
        ticks: [
          {
            atMs: 1760,
            condition: 'Vulnerability',
            stacks: 5,
            duration: 10
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.GEYSER]: {
    name: 'Geyser',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Staff',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 560,
    cooldown: 20,
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
  [ID.FROZEN_GROUNDS]: {
    name: 'Frozen Grounds',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Staff',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 280,
    cooldown: 30,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Ice',
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'condition',
        ticks: [
          {
            atMs: 160,
            condition: 'Chilled',
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
  [ID.HEALING_RAIN]: {
    name: 'Healing Rain',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Staff',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 840,
    cooldown: 35,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Water',
        duration: 6,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'boon',
        boon: 'Regeneration',
        stacks: 1,
        duration: 13,
        atMs: 720,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.CHAIN_LIGHTNING]: {
    name: 'Chain Lightning',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Staff',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 840,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    implemented: true,
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
    weapon: 'Staff',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 1000,
    cooldown: 10,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 800,
            coefficient: 1.8
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'blind',
        atMs: 800,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'blind'
        }
      }
    ]
  },
  [ID.GUST]: {
    name: 'Gust',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Staff',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 480,
    cooldown: 25,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'control',
        atMs: 180,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'crowd-control'
        }
      }
    ]
  },
  [ID.WINDBORNE_SPEED]: {
    name: 'Windborne Speed',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Staff',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 480,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'boon',
        boon: 'Swiftness',
        stacks: 1,
        duration: 10,
        atMs: 200,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'buff',
        kind: 'superspeed',
        stacks: 1,
        duration: 3,
        atMs: 200,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.STATIC_FIELD]: {
    name: 'Static Field',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Staff',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 680,
    cooldown: 30,
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
  [ID.STONING]: {
    name: 'Stoning',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Staff',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 880,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 600,
            coefficient: 1.2,
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
            condition: 'Weakness',
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
  [ID.ERUPTION]: {
    name: 'Eruption',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Staff',
    attunement: 'Earth',
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
            atMs: 4000,
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
        type: 'condition',
        ticks: [
          {
            atMs: 4000,
            condition: 'Bleeding',
            stacks: 6,
            duration: 12
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
            atMs: 4000,
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
  [ID.MAGNETIC_AURA]: {
    name: 'Magnetic Aura',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Staff',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 30,
    nextChainId: ID.TRANSMUTE_EARTH,
    aura: 'Magnetic|4',
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: []
  },
  [ID.TRANSMUTE_EARTH]: {
    name: 'Transmute Earth',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Staff',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 360,
    cooldown: 10,
    nextChainId: ID.MAGNETIC_AURA,
    skillFamily: 'Weapon skill',
    implemented: true,
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
    ],
    elementalistStateMachine: 'aura-transmute'
  },
  [ID.UNSTEADY_GROUND]: {
    name: 'Unsteady Ground',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Staff',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 720,
    cooldown: 30,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
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
  [ID.SHOCK_WAVE]: {
    name: 'Shock Wave',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Staff',
    attunement: 'Earth',
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
            atMs: 600,
            coefficient: 2.5,
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
            atMs: 600,
            condition: 'Immobilize',
            stacks: 1,
            duration: 2
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  }
});
