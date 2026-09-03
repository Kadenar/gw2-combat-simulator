/**
 * Pistol weapon-skill mechanics owned by the Core Elementalist module.
 *
 * Covers slots 1-3 in all four attunements plus the attunement-independent
 * Elemental Explosion. Most slot-2 and slot-3 skills either stock or spend an
 * elemental bullet; the bullet bookkeeping and the bonus effects a spent bullet
 * unlocks live in `core/mechanics/pistol-bullets.ts`, not in these fragments.
 */

import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

/**
 * Skill-id keyed fragments the Core module contributes to the pistol catalog.
 * Each entry declares the packet timeline the scheduler materializes for that skill.
 */
export const ELEMENTALIST_CORE_PISTOL_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SCORCHING_SHOT]: {
    name: 'Scorching Shot',
    type: 'Weapon',
    slot: 'Weapon_1',
    weapon: 'Pistol',
    attunement: 'Fire',
    categories: ['Weapon skill'],
    quicknessCastTimeMs: 520,
    interruptCommitMs: 400,
    cooldown: 0,
    skillFamily: 'Weapon skill',
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
        timingScale: 'cast',
        persistsAfterInterrupt: true
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
        persistsAfterInterrupt: true,
        metadata: {}
      }
    ]
  },
  // Stocks a Fire bullet, or spends one for extra Might that the pistol cast handler adds on top of the
  // Might declared here. `pistol-bullets` marks the skill as bullet-state-gated for rotation analysis.
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
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    elementalistStateMachine: 'pistol-bullets'
  },
  // Blast finisher up front, then a four-shot salvo landing together a second later. Spending a Fire
  // bullet additionally grants a Fire Aura through the pistol cast handler.
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
  // Five-shot channel with a Bleeding stack per shot; `per-packet` interruption keeps only the shots
  // that already landed.
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
  // Lays an ice field on impact. Spending a Water bullet also schedules a delayed detonation strike and
  // Bleeding from the pistol cast handler, which is why none of that appears in the declared effects.
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
  // Strike plus crowd control; spending an Air bullet opens the Dazing Discharge window tracked in
  // profession state rather than adding packets here.
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
        controlKind: 'crowd-control'
      }
    ],
    elementalistStateMachine: 'pistol-bullets'
  },
  // First link of the three-step Aerial Agility flipover chain. The zero-coefficient packet exists only
  // to fire the leap finisher. The chain reads the Air bullet without spending it, and the two later
  // links can never stock one.
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
    interruptCommitMs: 400,
    cooldown: 0,
    skillFamily: 'Weapon skill',
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
        timingScale: 'cast',
        persistsAfterInterrupt: true
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
        persistsAfterInterrupt: true,
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
  }
});
