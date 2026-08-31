/** Evoker Elementalist skill mechanics. */
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/content/professions/elementalist/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

/**
 * Simulator-owned skill definitions merged over the API catalog for Evoker.
 *
 * The eight familiar skills form four basic/empowered pairs linked by
 * `nextChainId` and tagged `elementalistStateMachine: 'evoker-familiar'`, which
 * is what routes them through the familiar hooks in `mechanics/familiars.ts`;
 * their gating is charge/empowered state in `mechanics/availability.ts`, not the
 * `cooldown: 0` declared here. The meditation utilities point at the shared
 * `elementalist.evoker-meditation` handler so Altruistic Aspect can extend them.
 */
export const EVOKER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.IGNITE]: {
    name: 'Ignite',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Evoker',
    attunement: 'Fire',
    mechanicSlot: 5,
    categories: ['Familiar'],
    quicknessCastTimeMs: 0,
    cooldown: 0,
    nextChainId: ID.CONFLAGRATION,
    skillFamily: 'Familiar',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 880,
            coefficient: 0.63
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
    elementalistStateMachine: 'evoker-familiar'
  },
  [ID.CONFLAGRATION]: {
    name: 'Conflagration',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Evoker',
    attunement: 'Fire',
    mechanicSlot: 5,
    categories: ['Familiar'],
    quicknessCastTimeMs: 360,
    cooldown: 0,
    nextChainId: ID.IGNITE,
    skillFamily: 'Familiar',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1040,
            coefficient: 1.56
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
            condition: 'Burning',
            stacks: 2,
            duration: 4.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    elementalistStateMachine: 'evoker-familiar'
  },
  [ID.SPLASH]: {
    name: 'Splash',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Evoker',
    attunement: 'Water',
    mechanicSlot: 5,
    categories: ['Familiar'],
    quicknessCastTimeMs: 0,
    cooldown: 0,
    nextChainId: ID.BUOYANT_DELUGE,
    skillFamily: 'Familiar',
    implemented: true,
    effects: [
      {
        type: 'boon',
        boon: 'Regeneration',
        stacks: 1,
        duration: 4,
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    elementalistStateMachine: 'evoker-familiar'
  },
  [ID.BUOYANT_DELUGE]: {
    name: 'Buoyant Deluge',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Evoker',
    attunement: 'Water',
    mechanicSlot: 5,
    categories: ['Familiar'],
    quicknessCastTimeMs: 360,
    cooldown: 0,
    nextChainId: ID.SPLASH,
    comboFields: [
      {
        ownerId: 'elementalist',
        fieldType: 'Water',
        duration: 4,
        startAnchor: 'castEnd'
      }
    ],
    skillFamily: 'Familiar',
    implemented: true,
    effects: [
      {
        type: 'control',
        atMs: 2200,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'crowd-control'
        }
      }
    ],
    elementalistStateMachine: 'evoker-familiar'
  },
  [ID.ZAP]: {
    name: 'Zap',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Evoker',
    attunement: 'Air',
    mechanicSlot: 5,
    categories: ['Familiar'],
    quicknessCastTimeMs: 0,
    cooldown: 0,
    nextChainId: ID.LIGHTNING_BLITZ,
    skillFamily: 'Familiar',
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
      }
    ],
    elementalistStateMachine: 'evoker-familiar'
  },
  [ID.LIGHTNING_BLITZ]: {
    name: 'Lightning Blitz',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Evoker',
    attunement: 'Air',
    mechanicSlot: 5,
    categories: ['Familiar'],
    quicknessCastTimeMs: 360,
    cooldown: 0,
    nextChainId: ID.ZAP,
    skillFamily: 'Familiar',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 1120,
            coefficient: 0.28
          },
          {
            atMs: 1360,
            coefficient: 0.28
          },
          {
            atMs: 1600,
            coefficient: 0.28
          },
          {
            atMs: 1840,
            coefficient: 0.28
          },
          {
            atMs: 2080,
            coefficient: 0.28
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 1120,
            condition: 'Weakness',
            stacks: 1,
            duration: 3
          },
          {
            atMs: 1360,
            condition: 'Weakness',
            stacks: 1,
            duration: 3
          },
          {
            atMs: 1600,
            condition: 'Weakness',
            stacks: 1,
            duration: 3
          },
          {
            atMs: 1840,
            condition: 'Weakness',
            stacks: 1,
            duration: 3
          },
          {
            atMs: 2080,
            condition: 'Weakness',
            stacks: 1,
            duration: 3
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ],
    elementalistStateMachine: 'evoker-familiar'
  },
  [ID.CALCIFY]: {
    name: 'Calcify',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Evoker',
    attunement: 'Earth',
    mechanicSlot: 5,
    categories: ['Familiar'],
    quicknessCastTimeMs: 0,
    cooldown: 0,
    nextChainId: ID.SEISMIC_IMPACT,
    skillFamily: 'Familiar',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 200,
            coefficient: 0.65
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        canCrit: true
      },
      {
        type: 'control',
        atMs: 200,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'crowd-control'
        }
      }
    ],
    elementalistStateMachine: 'evoker-familiar'
  },
  [ID.SEISMIC_IMPACT]: {
    name: 'Seismic Impact',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Evoker',
    attunement: 'Earth',
    mechanicSlot: 5,
    categories: ['Familiar'],
    quicknessCastTimeMs: 360,
    cooldown: 0,
    nextChainId: ID.CALCIFY,
    skillFamily: 'Familiar',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 2120,
            coefficient: 1.15,
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
            atMs: 2120,
            condition: 'Bleeding',
            stacks: 6,
            duration: 10
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      },
      {
        type: 'control',
        atMs: 2120,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'crowd-control'
        }
      }
    ],
    elementalistStateMachine: 'evoker-familiar'
  },
  [ID.FOXS_FURY]: {
    name: "Fox's Fury",
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Evoker',
    categories: ['Meditation'],
    quicknessCastTimeMs: 600,
    cooldown: 18,
    skillFamily: 'Meditation',
    handlerId: 'elementalist.evoker-meditation',
    implemented: true,
    effects: []
  },
  [ID.HARES_AGILITY]: {
    name: "Hare's Agility",
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Evoker',
    categories: ['Meditation'],
    quicknessCastTimeMs: 0,
    cooldown: 20,
    resourceGain: 50,
    skillFamily: 'Meditation',
    handlerId: 'elementalist.evoker-meditation',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 0,
            coefficient: 0.4
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
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.TOADS_FORTITUDE]: {
    name: "Toad's Fortitude",
    type: 'Utility',
    slot: 'Utility',
    specialization: 'Evoker',
    categories: ['Meditation'],
    quicknessCastTimeMs: 640,
    cooldown: 15,
    skillFamily: 'Meditation',
    handlerId: 'elementalist.evoker-meditation',
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          {
            atMs: 640,
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
            atMs: 640,
            condition: 'Bleeding',
            stacks: 4,
            duration: 10
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {}
      }
    ]
  },
  [ID.ELEMENTAL_PROCESSION]: {
    name: 'Elemental Procession',
    type: 'Elite',
    slot: 'Elite',
    specialization: 'Evoker',
    categories: ['Meditation'],
    quicknessCastTimeMs: 600,
    cooldown: 60,
    skillFamily: 'Meditation',
    handlerId: 'elementalist.evoker-meditation',
    implemented: true,
    effects: []
  },
  [ID.REJUVENATE]: {
    name: 'Rejuvenate',
    type: 'Heal',
    slot: 'Heal',
    specialization: 'Evoker',
    categories: ['Meditation'],
    quicknessCastTimeMs: 600,
    cooldown: 18,
    skillFamily: 'Meditation',
    implemented: true,
    effects: []
  }
});
