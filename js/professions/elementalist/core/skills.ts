/** Core Elementalist skill mechanics. */
import { ELEMENTALIST_SKILL_IDS as ID } from '../data/ids.js';
import { elementalistPacketEffects } from './skill-effects.js';
import type { Skill, SkillFragment } from '../../../platform/engine/types.js';

// Cast-scaled packet data is authored on the Quickness timeline and expands only for slower casts.
const DRAKES_BREATH_TICK_OFFSETS_MS = [520, 760, 1000, 1240] as const;
const BURNING_SPEED_FIELD_TICK_OFFSETS_MS = [160, 1160, 2160, 3160, 4160] as const;
const FLAMEWALL_TICK_OFFSETS_MS = [560, 1560, 2560, 3560, 4560, 5560, 6560, 7560, 8560] as const;
const WILDFIRE_TICK_OFFSETS_MS = [1560, 2560, 3560, 4560, 5560, 6560, 7560] as const;
const DUST_STORM_TICK_OFFSETS_MS = [1560, 2640, 3560, 4640, 5560, 6640, 7560, 8640] as const;
const FROST_VOLLEY_TICK_OFFSETS_MS = [360, 680, 1000, 1320, 1640] as const;
const GLYPH_OF_STORMS_FIRE_EARTH_TICK_OFFSETS_MS = [
  880, 1880, 2880, 3880, 4880, 5880, 6880, 7880, 8880, 9880, 10880
] as const;
const FIRESTORM_TICK_OFFSETS_MS = [520, 1520, 2520, 3520, 4520, 5520, 6520, 7520, 8520] as const;

export const ELEMENTALIST_CORE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
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
    effects: elementalistPacketEffects([
      [2320, 1.6],
      [2600, 1.44],
      [2920, 1.28],
      [3240, 1.12],
      [3400, 0.96],
      [3880, 0.8],
      [4480, 0.64],
      [4760, 0.48],
      [5080, 0.32],
      [5400, 0.32],
      [5560, 0.32],
      [6040, 0.32],
      [6640, 0.32],
      [6920, 0.32],
      [7240, 0.32],
      [7560, 0.32],
      [7720, 0.32],
      [8200, 0.32],
      [8800, 0.32],
      [9080, 0.32],
      [9400, 0.32],
      [9720, 0.32],
      [9880, 0.32],
      [10360, 0.32]
    ])
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
        durationScale: 'boon',
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
        durationScale: 'boon',
        atMs: 200,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'boon',
        boon: 'Superspeed',
        stacks: 1,
        duration: 3,
        durationScale: 'boon',
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
  },
  [ID.FLAMESTRIKE]: {
    name: 'Flamestrike',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Scepter',
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
            atMs: 240,
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
            atMs: 240,
            condition: 'Burning',
            stacks: 1,
            duration: 1.5
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
            condition: 'Burning',
            stacks: 1,
            duration: 2.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.DRAGONS_TOOTH]: {
    name: "Dragon's Tooth",
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Scepter',
    attunement: 'Fire',
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
            atMs: 2600,
            coefficient: 2.25,
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
            atMs: 2600,
            condition: 'Burning',
            stacks: 1,
            duration: 10
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.PHOENIX]: {
    name: 'Phoenix',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Scepter',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 480,
    cooldown: 10,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 320,
            coefficient: 0.75
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 360,
            coefficient: 1.7,
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
            atMs: 360,
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
        type: 'strike',
        ticks: [
          {
            atMs: 380,
            coefficient: 0.75
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'Vigor',
        stacks: 1,
        duration: 5,
        durationScale: 'boon',
        atMs: 380,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.ICE_SHARDS]: {
    name: 'Ice Shards',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Scepter',
    attunement: 'Water',
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
            atMs: 480,
            coefficient: 0.39999999999999997
          },
          {
            atMs: 480,
            coefficient: 0.39999999999999997
          },
          {
            atMs: 480,
            coefficient: 0.39999999999999997
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.SHATTERSTONE]: {
    name: 'Shatterstone',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Scepter',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 400,
    cooldown: 3,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 360,
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
            atMs: 360,
            condition: 'Chilled',
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
            atMs: 1040,
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
            atMs: 1040,
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
  [ID.WATER_TRIDENT]: {
    name: 'Water Trident',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Scepter',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 680,
    cooldown: 1,
    ammo: 2,
    ammoRecharge: 10,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 520,
            coefficient: 2.4
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.ARC_LIGHTNING]: {
    name: 'Arc Lightning',
    interruptMode: 'per-packet',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Scepter',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 2720,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        // Arc Lightning ramps over ten attacks: three stage-one, three stage-two, then four stage-three packets.
        ticks: [
          [440, 0.35],
          [680, 0.35],
          [960, 0.35],
          [1200, 0.4],
          [1440, 0.4],
          [1720, 0.4],
          [1960, 0.45],
          [2200, 0.45],
          [2480, 0.45],
          [2720, 0.45]
        ].map(([atMs, coefficient]) => ({ atMs, coefficient })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.LIGHTNING_STRIKE]: {
    name: 'Lightning Strike',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Scepter',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 5,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
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
            atMs: 0,
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
  [ID.BLINDING_FLASH]: {
    name: 'Blinding Flash',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Scepter',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 0.5,
    ammo: 2,
    ammoRecharge: 10,
    skillFamily: 'Weapon skill',
    implemented: true,
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
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 0,
            condition: 'Weakness',
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
  [ID.STONE_SHARDS]: {
    name: 'Stone Shards',
    interruptMode: 'per-packet',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Scepter',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 1400,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 720,
            coefficient: 0.5,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Projectile',
                chance: 0.2,
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
            atMs: 1000,
            coefficient: 0.5,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Projectile',
                chance: 0.2,
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
            atMs: 1000,
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
            atMs: 1240,
            coefficient: 0.5,
            comboFinishers: [
              {
                ownerId: 'elementalist',
                finisherType: 'Projectile',
                chance: 0.2,
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
            atMs: 1240,
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
  [ID.ROCK_BARRIER]: {
    name: 'Rock Barrier',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Scepter',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 760,
    cooldown: 8,
    nextChainId: ID.HURL,
    skillFamily: 'Weapon skill',
    implemented: true,
    // Rock Barrier opens Hurl's stored-barrier window after completion.
    mechanicTriggers: [
      {
        type: 'elementalist.core.open-rock-barrier',
        timingAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'boon',
        boon: 'Resistance',
        stacks: 1,
        duration: 4,
        durationScale: 'boon',
        atMs: 760,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    elementalistStateMachine: 'rock-barrier'
  },
  [ID.HURL]: {
    name: 'Hurl',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Scepter',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 0,
    nextChainId: ID.ROCK_BARRIER,
    skillFamily: 'Weapon skill',
    implemented: true,
    // Hurl consumes the stored barrier and starts Rock Barrier's real recharge.
    mechanicTriggers: [
      {
        type: 'elementalist.core.release-rock-barrier',
        timingAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 300,
            coefficient: 0.44,
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
            atMs: 300,
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
        type: 'strike',
        ticks: [
          {
            atMs: 500,
            coefficient: 0.44,
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
            atMs: 500,
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
        type: 'strike',
        ticks: [
          {
            atMs: 700,
            coefficient: 0.44,
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
            atMs: 700,
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
        type: 'strike',
        ticks: [
          {
            atMs: 900,
            coefficient: 0.44,
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
            atMs: 900,
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
        type: 'strike',
        ticks: [
          {
            atMs: 1100,
            coefficient: 0.44,
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
            atMs: 1100,
            condition: 'Bleeding',
            stacks: 1,
            duration: 8
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    elementalistStateMachine: 'rock-barrier'
  },
  [ID.DUST_DEVIL]: {
    name: 'Dust Devil',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Scepter',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 320,
    cooldown: 15,
    // EVTC shows the dust projectile committing at 160 ms and striking again at one-second intervals.
    interruptCommitMs: 160,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 160,
            coefficient: 0.4
          },
          {
            atMs: 1160,
            coefficient: 0.4
          },
          {
            atMs: 2160,
            coefficient: 0.4
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'blind',
        atMs: 160,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: {
          controlKind: 'blind'
        }
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 160,
            condition: 'Cripple',
            stacks: 1,
            duration: 1.5
          },
          {
            atMs: 1160,
            condition: 'Cripple',
            stacks: 1,
            duration: 1.5
          },
          {
            atMs: 2160,
            condition: 'Cripple',
            stacks: 1,
            duration: 1.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        metadata: {}
      }
    ]
  },
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
    implemented: true,
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
    implemented: true,
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
    implemented: true,
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
    implemented: true,
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
            metadata: {
              damageKind: 'field-tick'
            }
          },
          {
            atMs: 2600,
            coefficient: 0.5,
            metadata: {
              damageKind: 'field-tick'
            }
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
    implemented: true,
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
    implemented: true,
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
    implemented: true,
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
    implemented: true,
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
    implemented: true,
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
        durationScale: 'boon',
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
    implemented: true,
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
        durationScale: 'boon',
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
    implemented: true,
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
      },
      {
        type: 'boon',
        boon: 'Swiftness',
        stacks: 1,
        duration: 2,
        durationScale: 'boon',
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
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
    implemented: true,
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
    implemented: true,
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
        type: 'boon',
        boon: 'Superspeed',
        stacks: 1,
        duration: 3,
        durationScale: 'boon',
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
        metadata: {
          controlKind: 'crowd-control'
        }
      }
    ]
  },
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
    implemented: true,
    effects: elementalistPacketEffects(
      [
        [600, 0.5],
        [800, 0.425],
        [1000, 0.425],
        [1200, 0.425],
        [1400, 0.425],
        [1600, 0.425],
        [1800, 0.425],
        [2000, 0.425],
        [2200, 0.425]
      ],
      { condition: { condition: 'Vulnerability', stacks: 1, duration: 8 } }
    )
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
    implemented: true,
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
    implemented: true,
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
    implemented: true,
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
    implemented: true,
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
    implemented: true,
    effects: elementalistPacketEffects(
      [
        [360, 0.33],
        [360, 0.33],
        [600, 0.33],
        [640, 0.33],
        [840, 0.33],
        [840, 0.33],
        [1080, 0.33],
        [1120, 0.33]
      ],
      { condition: { condition: 'Bleeding', stacks: 1, duration: 4 } }
    )
  },
  [ID.DRAGONS_CLAW]: {
    name: "Dragon's Claw",
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Dagger',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 720,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 440,
            coefficient: 0.45
          },
          {
            atMs: 440,
            coefficient: 0.45
          },
          {
            atMs: 440,
            coefficient: 0.45
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.DRAKES_BREATH]: {
    name: "Drake's Breath",
    interruptMode: 'per-packet',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Dagger',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 1360,
    cooldown: 5,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: DRAKES_BREATH_TICK_OFFSETS_MS.map((atMs) => ({
          atMs,
          coefficient: 1.05
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: DRAKES_BREATH_TICK_OFFSETS_MS.map((atMs) => ({
          atMs,
          condition: 'Burning',
          stacks: 1,
          duration: 4
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.BURNING_SPEED]: {
    name: 'Burning Speed',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Dagger',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 800,
    cooldown: 12,
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
            atMs: 800,
            coefficient: 3
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 800,
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
        ticks: BURNING_SPEED_FIELD_TICK_OFFSETS_MS.map((atMs) => ({
          atMs,
          coefficient: 0.2,
          metadata: {
            damageKind: 'field-tick'
          }
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: BURNING_SPEED_FIELD_TICK_OFFSETS_MS.map((atMs) => ({
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
  [ID.RING_OF_FIRE]: {
    name: 'Ring of Fire',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Dagger',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 480,
    cooldown: 15,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Fire',
        duration: 5,
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
            atMs: 280,
            coefficient: 2
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
            condition: 'Burning',
            stacks: 2,
            duration: 4
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.FIRE_GRAB]: {
    name: 'Fire Grab',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Dagger',
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
            atMs: 480,
            coefficient: 3.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.VAPOR_BLADE]: {
    name: 'Vapor Blade',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Dagger',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 360,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 360,
            coefficient: 0.33
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
            atMs: 1360,
            coefficient: 0.33
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 1360,
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
  [ID.CONE_OF_COLD]: {
    name: 'Cone of Cold',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Dagger',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 1360,
    cooldown: 10,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 520,
            coefficient: 0.6
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
            coefficient: 0.6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1000,
            coefficient: 0.6
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
            coefficient: 0.6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.FROZEN_BURST]: {
    name: 'Frozen Burst',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Dagger',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 600,
    cooldown: 12,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Ice',
        duration: 2,
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
            atMs: 200,
            coefficient: 0.4,
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
            atMs: 200,
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
  [ID.FROST_AURA]: {
    name: 'Frost Aura',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Dagger',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 10,
    nextChainId: ID.TRANSMUTE_FROST,
    aura: 'Frost|10',
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: []
  },
  [ID.TRANSMUTE_FROST]: {
    name: 'Transmute Frost',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Dagger',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 360,
    cooldown: 10,
    nextChainId: ID.FROST_AURA,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 840,
            coefficient: 0.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'Regeneration',
        stacks: 1,
        duration: 4,
        durationScale: 'boon',
        atMs: 840,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    elementalistStateMachine: 'aura-transmute'
  },
  [ID.CLEANSING_WAVE]: {
    name: 'Cleansing Wave',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Dagger',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 960,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: []
  },
  [ID.LIGHTNING_WHIP]: {
    name: 'Lightning Whip',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Dagger',
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
            atMs: 360,
            coefficient: 0.75
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [
          {
            atMs: 560,
            coefficient: 0.75
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.CONVERGENCE]: {
    name: 'Convergence',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Dagger',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 360,
    cooldown: 8,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1320,
            coefficient: 2.4,
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
            atMs: 1320,
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
        type: 'boon',
        boon: 'Fury',
        stacks: 1,
        duration: 2.5,
        durationScale: 'boon',
        atMs: 1320,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.SHOCKING_AURA]: {
    name: 'Shocking Aura',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Dagger',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 0,
    cooldown: 10,
    nextChainId: ID.TRANSMUTE_LIGHTNING,
    aura: 'Shocking|10',
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: []
  },
  [ID.TRANSMUTE_LIGHTNING]: {
    name: 'Transmute Lightning',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Dagger',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 360,
    cooldown: 10,
    nextChainId: ID.SHOCKING_AURA,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 840,
            coefficient: 1.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        canCrit: true
      },
      {
        type: 'control',
        atMs: 840,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'crowd-control'
        }
      }
    ],
    elementalistStateMachine: 'aura-transmute'
  },
  [ID.RIDE_THE_LIGHTNING]: {
    name: 'Ride the Lightning',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Dagger',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 120,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 80,
            coefficient: 1.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.UPDRAFT]: {
    name: 'Updraft',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Dagger',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 880,
    cooldown: 20,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        // Updraft's launch registers a 0-damage strike, which is what lets it
        // trigger on-hit effects such as Relic of Fireworks despite dealing no
        // damage.
        type: 'strike',
        ticks: [
          {
            atMs: 880,
            coefficient: 0
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'Swiftness',
        stacks: 1,
        duration: 10,
        durationScale: 'boon',
        atMs: 880,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'control',
        atMs: 880,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'crowd-control'
        }
      }
    ]
  },
  [ID.IMPALE]: {
    name: 'Impale',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Dagger',
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
            atMs: 640,
            coefficient: 0.77
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 640,
            condition: 'Bleeding',
            stacks: 1,
            duration: 10
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.RING_OF_EARTH]: {
    name: 'Ring of Earth',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Dagger',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 880,
    cooldown: 6,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 200,
            coefficient: 0.33
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 200,
            condition: 'Bleeding',
            stacks: 3,
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
            atMs: 200,
            condition: 'Cripple',
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
            atMs: 760,
            coefficient: 1.9
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
            stacks: 3,
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
            atMs: 760,
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
  [ID.EARTHEN_RUSH]: {
    name: 'Earthen Rush',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Dagger',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 640,
    cooldown: 12,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 280,
            coefficient: 2.3,
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
            atMs: 280,
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
  },
  [ID.EARTHQUAKE]: {
    name: 'Earthquake',
    type: 'Weapon',
    slot: 'Weapon_4',
    weapon: 'Dagger',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 680,
    cooldown: 16,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 480,
            coefficient: 3,
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
  [ID.CHURNING_EARTH]: {
    name: 'Churning Earth',
    type: 'Weapon',
    slot: 'Weapon_5',
    weapon: 'Dagger',
    attunement: 'Earth',
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
            atMs: 0,
            coefficient: 0,
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
        type: 'strike',
        ticks: [
          {
            atMs: 800,
            coefficient: 3
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 800,
            condition: 'Bleeding',
            stacks: 10,
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
            atMs: 800,
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
        durationScale: 'boon',
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
  },
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
        durationScale: 'boon',
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
        durationScale: 'boon',
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
        durationScale: 'boon',
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'boon',
        boon: 'Superspeed',
        stacks: 1,
        duration: 2.5,
        durationScale: 'boon',
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
        durationScale: 'boon',
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
        durationScale: 'boon',
        atMs: 1560,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
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
        durationScale: 'boon',
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
        durationScale: 'boon',
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
        type: 'boon',
        boon: 'Superspeed',
        stacks: 1,
        duration: 3,
        durationScale: 'boon',
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
  },
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
        durationScale: 'boon',
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
        durationScale: 'boon',
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
        type: 'boon',
        boon: 'Superspeed',
        stacks: 1,
        duration: 3,
        durationScale: 'boon',
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
  },
  [ID.SCORCHING_SHOT]: {
    name: 'Scorching Shot',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Pistol',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 520,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 360,
            coefficient: 0.3
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
  [ID.RAGING_RICOCHET]: {
    name: 'Raging Ricochet',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Pistol',
    attunement: 'Fire',
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
            atMs: 360,
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
            atMs: 360,
            condition: 'Burning',
            stacks: 1,
            duration: 8
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'boon',
        boon: 'Might',
        stacks: 1,
        duration: 6,
        durationScale: 'boon',
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    elementalistStateMachine: 'pistol-bullets'
  },
  [ID.SEARING_SALVO]: {
    name: 'Searing Salvo',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Pistol',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 680,
    cooldown: 12,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 440,
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
            atMs: 440,
            condition: 'Burning',
            stacks: 1,
            duration: 7
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
            atMs: 1440,
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
            atMs: 1440,
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
            atMs: 1440,
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
            atMs: 1440,
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
            atMs: 1440,
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
            atMs: 1440,
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
            atMs: 1440,
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
            atMs: 1440,
            condition: 'Burning',
            stacks: 1,
            duration: 2
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    elementalistStateMachine: 'pistol-bullets'
  },
  [ID.SOOTHING_SPLASH]: {
    name: 'Soothing Splash',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Pistol',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 520,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 360,
            coefficient: 0.4
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.FRIGID_FLURRY]: {
    name: 'Frigid Flurry',
    interruptMode: 'per-packet',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Pistol',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 1000,
    cooldown: 5,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 280,
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
            atMs: 280,
            condition: 'Bleeding',
            stacks: 1,
            duration: 7
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
            atMs: 440,
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
            atMs: 440,
            condition: 'Bleeding',
            stacks: 1,
            duration: 7
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
            atMs: 640,
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
            atMs: 640,
            condition: 'Bleeding',
            stacks: 1,
            duration: 7
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
            atMs: 800,
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
            atMs: 800,
            condition: 'Bleeding',
            stacks: 1,
            duration: 7
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
            atMs: 960,
            condition: 'Bleeding',
            stacks: 1,
            duration: 7
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    elementalistStateMachine: 'pistol-bullets'
  },
  [ID.FROZEN_FUSILLADE]: {
    name: 'Frozen Fusillade',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Pistol',
    attunement: 'Water',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 520,
    cooldown: 15,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Ice',
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
            atMs: 360,
            coefficient: 0.75
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
            duration: 1.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    elementalistStateMachine: 'pistol-bullets'
  },
  [ID.ELECTRIC_EXPOSURE]: {
    name: 'Electric Exposure',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Pistol',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 520,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 360,
            coefficient: 0.33
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
  [ID.DAZING_DISCHARGE]: {
    name: 'Dazing Discharge',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Pistol',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 440,
    cooldown: 8,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 280,
            coefficient: 0.75
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
            atMs: 280,
            condition: 'Vulnerability',
            stacks: 8,
            duration: 10
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
        metadata: {
          controlKind: 'crowd-control'
        }
      }
    ],
    elementalistStateMachine: 'pistol-bullets'
  },
  [ID.AERIAL_AGILITY]: {
    name: 'Aerial Agility',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Pistol',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 520,
    cooldown: 12,
    nextChainId: ID.AERIAL_AGILITY_CHAIN,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 360,
            coefficient: 0,
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
  [ID.AERIAL_AGILITY_CHAIN]: {
    name: 'Aerial Agility (chain)',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Pistol',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 480,
    cooldown: 0,
    nextChainId: ID.AERIAL_AGILITY_DASH,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 360,
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
            atMs: 360,
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
  [ID.AERIAL_AGILITY_DASH]: {
    name: 'Aerial Agility (dash)',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Pistol',
    attunement: 'Air',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 520,
    cooldown: 0,
    nextChainId: ID.AERIAL_AGILITY,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 360,
            coefficient: 0,
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
        boon: 'Aegis',
        stacks: 1,
        duration: 3,
        durationScale: 'boon',
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.PIERCING_PEBBLE]: {
    name: 'Piercing Pebble',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Pistol',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 520,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 360,
            coefficient: 0.35
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
            duration: 5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.SHATTERING_STONE]: {
    name: 'Shattering Stone',
    type: 'Weapon',
    slot: 'Weapon_2',
    weapon: 'Pistol',
    attunement: 'Earth',
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
            atMs: 360,
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
            atMs: 360,
            condition: 'Bleeding',
            stacks: 3,
            duration: 10
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    elementalistStateMachine: 'pistol-bullets'
  },
  [ID.BOULDER_BLAST]: {
    name: 'Boulder Blast',
    type: 'Weapon',
    slot: 'Weapon_3',
    weapon: 'Pistol',
    attunement: 'Earth',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 440,
    cooldown: 12,
    skillFamily: 'Weapon skill',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 400,
            coefficient: 0.44,
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
            atMs: 400,
            condition: 'Bleeding',
            stacks: 5,
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
            atMs: 400,
            condition: 'Immobilize',
            stacks: 1,
            duration: 1.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    elementalistStateMachine: 'pistol-bullets'
  },
  [ID.ELEMENTAL_EXPLOSION]: {
    name: 'Elemental Explosion',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Pistol',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 520,
    cooldown: 0,
    skillFamily: 'Weapon skill',
    implemented: true,
    // Elemental Explosion consumes every stored bullet and grants the current attunement's aura.
    mechanicTriggers: [
      {
        type: 'elementalist.core.consume-elemental-explosion',
        timingAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 520,
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
            atMs: 520,
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
        type: 'strike',
        ticks: [
          {
            atMs: 600,
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
            atMs: 600,
            condition: 'Bleeding',
            stacks: 4,
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
            atMs: 680,
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
            atMs: 680,
            condition: 'Vulnerability',
            stacks: 4,
            duration: 10
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
            atMs: 760,
            condition: 'Cripple',
            stacks: 1,
            duration: 4
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    elementalistStateMachine: 'pistol-bullets'
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
        durationScale: 'boon',
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
