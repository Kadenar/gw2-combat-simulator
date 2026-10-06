import { selectIgniteEffects } from '#gw2/professions/elementalist/specializations/evoker/mechanics/familiars.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';
/**
 * Owns Evoker familiar basic and empowered skill fragments.
 * Familiar charge, flip, and attunement state lives in `mechanics/familiars.ts`.
 */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/**
 * Simulator-owned skill definitions merged over the API catalog for Evoker.
 *
 * The eight familiar skills form four basic/empowered pairs linked by
 * `nextChainId`. Definitions declare their start and commit behavior; gating uses
 * charge/empowered state in `mechanics/availability.ts`, not the `cooldown: 0`
 * declared here.
 */
// Shared impact timing keeps companion payloads independent and in their authored order.
export const EVOKER_FAMILIAR_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.IGNITE]: {
    // Acceptance owns flip interruption; commitment applies the intrinsic bonus before settling this form's resources.
    sideEffects: [
      { on: 'castStart', do: { type: 'elementalist.evoker.begin-familiar' } },
      { on: 'castStart', do: { type: 'elementalist.evoker.capture-ignite-tier' } },
      { on: 'castCommit', do: { type: 'elementalist.evoker.settle-basic-familiar' } }
    ],
    // The start action snapshots one tier; repeated packet selection cannot increment it again.
    effectVariants: [
      { when: () => true, profileId: PROFILE.ignite, transform: (_runtime, cast) => selectIgniteEffects(cast) }
    ],

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
    // Acceptance owns flip interruption; commitment applies the intrinsic bonus before settling this form's resources.
    sideEffects: [
      { on: 'castStart', do: { type: 'elementalist.evoker.begin-familiar' } },
      { on: 'castCommit', do: { type: 'elementalist.evoker.settle-empowered-familiar' } }
    ],

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
        {
          type: 'condition',
          condition: 'Burning',
          stacks: 2,
          duration: 4.5,
          metadata: {}
        }
      ]
    )
  },
  [ID.SPLASH]: {
    // Acceptance owns flip interruption; commitment applies the intrinsic bonus before settling this form's resources.
    sideEffects: [
      { on: 'castStart', do: { type: 'elementalist.evoker.begin-familiar' } },
      { on: 'castCommit', do: { type: 'elementalist.evoker.settle-basic-familiar' } }
    ],

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
    // Acceptance owns flip interruption; commitment applies the intrinsic bonus before settling this form's resources.
    sideEffects: [
      { on: 'castStart', do: { type: 'elementalist.evoker.begin-familiar' } },
      { on: 'castCommit', do: { type: 'elementalist.evoker.settle-empowered-familiar' } }
    ],

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
    // Acceptance owns flip interruption; commitment applies the intrinsic bonus before settling this form's resources.
    sideEffects: [
      { on: 'castStart', do: { type: 'elementalist.evoker.begin-familiar' } },
      { on: 'castCommit', do: { type: 'elementalist.evoker.zap' } },
      { on: 'castCommit', do: { type: 'elementalist.evoker.settle-basic-familiar' } }
    ],

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
    // Acceptance owns flip interruption; commitment applies the intrinsic bonus before settling this form's resources.
    sideEffects: [
      { on: 'castStart', do: { type: 'elementalist.evoker.begin-familiar' } },
      { on: 'castCommit', do: { type: 'elementalist.evoker.lightning-blitz' } },
      { on: 'castCommit', do: { type: 'elementalist.evoker.settle-empowered-familiar' } }
    ],

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
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: [1120, 1360, 1600, 1840, 2080].map((atMs) => ({ atMs, coefficient: 0.28 }))
      },
      {
        type: 'condition',
        ticks: [1120, 1360, 1600, 1840, 2080].map((atMs) => ({ atMs, condition: 'Weakness', stacks: 1, duration: 3 })),
        metadata: {}
      }
    ])
  },
  [ID.CALCIFY]: {
    // Acceptance owns flip interruption; commitment applies the intrinsic bonus before settling this form's resources.
    sideEffects: [
      { on: 'castStart', do: { type: 'elementalist.evoker.begin-familiar' } },
      { on: 'castCommit', do: { type: 'elementalist.evoker.settle-basic-familiar' } }
    ],

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
    // Acceptance owns flip interruption; commitment applies the intrinsic bonus before settling this form's resources.
    sideEffects: [
      { on: 'castStart', do: { type: 'elementalist.evoker.begin-familiar' } },
      { on: 'castCommit', do: { type: 'elementalist.evoker.settle-empowered-familiar' } }
    ],

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
      // The initial knockdown triggers disable passives before the later damage and barrier pulses.
      { type: 'control', applications: 1, controlKind: 'crowd-control', atMs: 1320 },
      // The barrier supplies party Protection independently of hitting an enemy; its pulses keep a fixed cadence.
      {
        type: 'boon',
        boon: 'Protection',
        stacks: 1,
        duration: 1.5,
        applications: 5,
        atMs: 2320,
        intervalMs: 1000,
        intervalTimingScale: 'fixed',
        audience: { recipients: 'party', maximumRecipients: 5 }
      }
    ])
  }
});
