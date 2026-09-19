/**
 * Owns Evoker familiar basic and empowered skill fragments.
 * Familiar charge, flip, and attunement state lives in `mechanics/familiars.ts`.
 */
import { impactEffects } from '#gw2/platform/engine/effects/factories.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

/**
 * Simulator-owned skill definitions merged over the API catalog for Evoker.
 *
 * The eight familiar skills form four basic/empowered pairs linked by
 * `nextChainId`. Familiar hooks own their behavior, and their gating is
 * charge/empowered state in `mechanics/availability.ts`, not the `cooldown: 0`
 * declared here.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const EVOKER_FAMILIAR_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.IGNITE]: {
    name: 'Ignite',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Evoker',
    attunement: 'Fire',
    mechanicSlot: 5,
    categories: ['Familiar'],
    castTimeMs: 0,
    cooldown: 0,
    nextChainId: ID.CONFLAGRATION,
    skillFamily: 'Familiar',
    effects: impactEffects({ atMs: 880, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.63 },
      { type: 'condition', condition: 'Burning', stacks: 1, duration: 2, metadata: {} }
    ])
  },
  [ID.CONFLAGRATION]: {
    name: 'Conflagration',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Evoker',
    attunement: 'Fire',
    mechanicSlot: 5,
    categories: ['Familiar'],
    castTimeMs: 360,
    // A released Conflagration survives cutting the command animation short.
    interruptCommitMs: 320,
    cooldown: 0,
    nextChainId: ID.IGNITE,
    skillFamily: 'Familiar',
    effects: impactEffects(
      { atMs: 1040, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 1.56 },
        { type: 'condition', condition: 'Burning', stacks: 2, duration: 4.5, metadata: {} }
      ]
    )
  },
  [ID.SPLASH]: {
    name: 'Splash',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Evoker',
    attunement: 'Water',
    mechanicSlot: 5,
    categories: ['Familiar'],
    castTimeMs: 0,
    cooldown: 0,
    nextChainId: ID.BUOYANT_DELUGE,
    skillFamily: 'Familiar',
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
    ]
  },
  [ID.BUOYANT_DELUGE]: {
    name: 'Buoyant Deluge',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Evoker',
    attunement: 'Water',
    mechanicSlot: 5,
    categories: ['Familiar'],
    castTimeMs: 360,
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
    effects: [
      {
        type: 'control',
        atMs: 2200,
        applications: 1,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: 'crowd-control'
      }
    ]
  },
  [ID.ZAP]: {
    name: 'Zap',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Evoker',
    attunement: 'Air',
    mechanicSlot: 5,
    categories: ['Familiar'],
    castTimeMs: 0,
    cooldown: 0,
    nextChainId: ID.LIGHTNING_BLITZ,
    skillFamily: 'Familiar',
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
    ]
  },
  [ID.LIGHTNING_BLITZ]: {
    name: 'Lightning Blitz',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Evoker',
    attunement: 'Air',
    mechanicSlot: 5,
    categories: ['Familiar'],
    castTimeMs: 360,
    cooldown: 0,
    nextChainId: ID.ZAP,
    skillFamily: 'Familiar',
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
    ]
  },
  [ID.CALCIFY]: {
    name: 'Calcify',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Evoker',
    attunement: 'Earth',
    mechanicSlot: 5,
    categories: ['Familiar'],
    castTimeMs: 0,
    cooldown: 0,
    nextChainId: ID.SEISMIC_IMPACT,
    skillFamily: 'Familiar',
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.65, canCrit: true },
      { type: 'control', applications: 1, controlKind: 'crowd-control' }
    ])
  },
  [ID.SEISMIC_IMPACT]: {
    name: 'Seismic Impact',
    type: 'Profession',
    slot: 'Profession_5',
    specialization: 'Evoker',
    attunement: 'Earth',
    mechanicSlot: 5,
    categories: ['Familiar'],
    castTimeMs: 360,
    cooldown: 0,
    nextChainId: ID.CALCIFY,
    skillFamily: 'Familiar',
    effects: impactEffects({ atMs: 2120, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 1.15,
        comboFinishers: [
          {
            attemptGroup: 'effect:1:tick:1',
            ownerId: 'elementalist',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {},
        canCrit: true
      },
      { type: 'condition', condition: 'Bleeding', stacks: 6, duration: 10, metadata: {} },
      { type: 'control', applications: 1, controlKind: 'crowd-control' }
    ])
  }
});
