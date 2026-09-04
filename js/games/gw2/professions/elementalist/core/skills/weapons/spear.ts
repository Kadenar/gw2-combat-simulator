/**
 * Spear weapon-skill mechanics owned by the Core Elementalist module.
 *
 * Covers slots 1-5 across all four attunements, including the two spear-specific systems:
 * the slot-3 follow-up empowerments (Seethe/Ripple/Energize/Harden arm a one-shot bonus on
 * the next qualifying spear cast) and the slot-5 Etching chains, where `Etching: X` places a
 * combo field and unlocks `Lesser X`, which three further casts upgrade to the full `X`.
 *
 * Declarative data only: the named `mechanicTriggers` are implemented by
 * `core/execution/index.ts`, the chain/stage gating lives in
 * `core/mechanics/availability.ts`, and the table is merged in by `core/skills/index.ts`.
 */

import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

/**
 * Skill-id keyed fragments the catalog layers over the raw spear skill records so the
 * simulator knows each skill's cast timeline, emitted packets, and combo participation.
 */
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
    // EVTC damage lands 520ms after activation; once the projectile reaches that
    // commit point, preserve its impact even if the remaining animation is cancelled.
    interruptCommitMs: 520,
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
        timingScale: 'cast',
        persistsAfterInterrupt: true
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
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
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
  // Etching root: lays the fire field and arms the Volcano chain at its `lesser` stage; the
  // payoff skills below occupy the same slot and are gated on that stage.
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
    effects: [
      {
        type: 'boon',
        boon: 'Might',
        stacks: 1,
        duration: 8,
        atMs: 240,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  // Early payoff: six eruption packets whose coefficients decay from 0.63 down to 0.315.
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
    ]
  },
  // Full payoff: twelve eruption packets decaying from 1.21 to a 0.05 floor.
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
    ]
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
  // Three beam pulses at 360/520/720ms, each applying its own one-second Chilled stack.
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
    // Ripple empowers the next qualifying spear recharge after completion.
    mechanicTriggers: [
      {
        type: 'elementalist.core.arm-spear-recharge',
        timingAnchor: 'castEnd'
      }
    ],
    effects: []
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
        controlKind: 'crowd-control'
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
    effects: []
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
    ]
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
    ]
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
    // EVTC damage lands 520ms after activation; once the projectile reaches that
    // commit point, preserve its strike and vulnerability if the animation is cancelled.
    interruptCommitMs: 520,
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
        timingScale: 'cast',
        persistsAfterInterrupt: true
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
        persistsAfterInterrupt: true,
        metadata: {}
      }
    ]
  },
  // Lingering aura: five pulses one second apart, each a strike plus one Vulnerability stack,
  // so most of the damage lands well after the 560ms cast.
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
    // Energize guarantees the next qualifying spear critical hit after completion.
    mechanicTriggers: [
      {
        type: 'elementalist.core.arm-spear-critical',
        timingAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'buff',
        kind: 'superspeed',
        stacks: 1,
        duration: 4,
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
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
        controlKind: 'crowd-control'
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
    effects: [
      {
        type: 'boon',
        boon: 'Fury',
        stacks: 1,
        duration: 7,
        atMs: 240,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
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
        controlKind: 'crowd-control'
      }
    ]
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
        controlKind: 'crowd-control'
      }
    ]
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
    // Harden adds control to the next qualifying spear hit after completion.
    mechanicTriggers: [
      {
        type: 'elementalist.core.arm-spear-control',
        timingAnchor: 'castEnd'
      }
    ],
    effects: []
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
  // Earth's etching root is the odd one out: it lays a Dark field rather than an elemental one.
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
    effects: []
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
        controlKind: 'blind'
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
    ]
  },
  // Full payoff: the Lesser version's strike and blind plus Vulnerability and Weakness.
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
        controlKind: 'blind'
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
    ]
  }
});
