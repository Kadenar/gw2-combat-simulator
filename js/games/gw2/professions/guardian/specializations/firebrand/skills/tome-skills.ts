import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

/**
 * Owns Firebrand tome and tome-page skill fragments.
 * Persistent tome page state and behavior remain under `mechanics/`.
 */

export const FIREBRAND_TOME_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.SCORCHED_AFTERMATH]: {
    // Debit on commitment before the earned Swift Scholar refund.
    resourceCost: 1,
    cost: { resource: 'tomePages', spendOn: 'castCommit' },
    castTimeMs: 920,
    // The Fire combo field lasts four seconds from the first pulse.
    comboFields: [{ ownerId: 'guardian', fieldType: 'Fire', duration: 4, startMs: 440, startAnchor: 'castStart' }],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [440, 1440, 2440, 3440, 4440].map((atMs) => ({
          atMs,
          coefficient: 0.64
        }))
      },
      // Each pulse applies both conditions, retaining their separate durations and packet order.
      ...(
        [
          { condition: 'Burning', duration: 3 },
          { condition: 'Bleeding', duration: 5 }
        ] as const
      ).flatMap(({ condition, duration }) =>
        [440, 1440, 2440, 3440, 4440].map((atMs) => ({
          type: 'condition' as const,
          ticks: [{ atMs, condition, stacks: 1, duration }]
        }))
      )
    ])
  },
  [ID.IGNITING_BURST]: {
    // Debit on commitment before the earned Swift Scholar refund.
    resourceCost: 1,
    cost: { resource: 'tomePages', spendOn: 'castCommit' },
    castTimeMs: 480,
    // Keep the page's strike, Burning, and Weakness on one impact.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.55
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 10
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 4
      }
    ])
  },
  [ID.RADIANT_RECOVERY]: {
    // Debit on commitment before the earned Swift Scholar refund.
    resourceCost: 1,
    cost: { resource: 'tomePages', spendOn: 'castCommit' },
    castTimeMs: 200,
    effects: []
  },
  [ID.STALWART_STAND]: {
    // Debit on commitment before the earned Swift Scholar refund.
    resourceCost: 1,
    cost: { resource: 'tomePages', spendOn: 'castCommit' },
    castTimeMs: 200,
    effects: [
      {
        type: 'boon',
        boon: 'resistance',
        duration: 1
      },
      {
        type: 'boon',
        boon: 'resistance',
        duration: 1,
        atMs: 1240,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'resistance',
        duration: 1,
        atMs: 2240,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'resistance',
        duration: 1,
        atMs: 3240,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SEARING_SPELL]: {
    // Debit on commitment before the earned Swift Scholar refund.
    resourceCost: 1,
    cost: { resource: 'tomePages', spendOn: 'castCommit' },
    castTimeMs: 680,
    // A cancel after commitment retains the completed page use and its effects.
    interruptCommitMs: 480,
    // Keep the committed page's strike and conditions on one impact.
    effects: impactEffects(
      { atMs: 320, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 0.95
        },
        {
          type: 'condition',
          condition: 'Burning',
          stacks: 1,
          duration: 2.5
        },
        {
          type: 'condition',
          condition: 'Vulnerability',
          stacks: 2,
          duration: 10
        }
      ]
    )
  },
  [ID.STOW_TOME]: {
    // Stow closes the bar and ends its Swift Scholar session.
    sideEffects: [{ on: 'castCommit', do: { type: 'guardian.stow-tome' } }],
    // Tome transitions change the available bar without cancelling the active animation.
    canCastConcurrently: true,
    castTimeMs: 0,
    // Custom: Closes the active tome and updates tome state; see `firebrand/mechanics/tomes.ts`.
    inputCategory: 'bar-swap',
    effects: []
  },
  [ID.TOME_OF_RESOLVE]: {
    // Reopening preserves the shared dormancy and session controller.
    sideEffects: [{ on: 'castCommit', do: { type: 'guardian.open-resolve' } }],
    inputCategory: 'bar-swap', // Explicit weapon or profession bar replacement.
    // Tome transitions change the available bar without cancelling the active animation.
    canCastConcurrently: true,
    castTimeMs: 0,
    effects: []
  },
  [ID.VALIANT_BULWARK]: {
    // Debit on commitment before the earned Swift Scholar refund.
    resourceCost: 1,
    cost: { resource: 'tomePages', spendOn: 'castCommit' },
    castTimeMs: 200,
    effects: []
  },
  [ID.DARING_CHALLENGE]: {
    // Debit on commitment before the earned Swift Scholar refund.
    resourceCost: 1,
    cost: { resource: 'tomePages', spendOn: 'castCommit' },
    castTimeMs: 200,
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1
      },
      {
        type: 'control',
        controlKind: 'taunt'
      },
      {
        type: 'boon',
        boon: 'resolution',
        duration: 3
      }
    ]
  },
  [ID.SHINING_RIVER]: {
    // Debit on commitment before the earned Swift Scholar refund.
    resourceCost: 1,
    cost: { resource: 'tomePages', spendOn: 'castCommit' },
    castTimeMs: 200,
    effects: [
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 5
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 5,
        atMs: 1240,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 5,
        atMs: 2240,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 5,
        atMs: 3240,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 5,
        atMs: 4240,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.TOME_OF_COURAGE]: {
    // Reopening preserves the shared dormancy and session controller.
    sideEffects: [{ on: 'castCommit', do: { type: 'guardian.open-courage' } }],
    inputCategory: 'bar-swap', // Explicit weapon or profession bar replacement.
    canCastConcurrently: true,
    castTimeMs: 0,
    effects: []
  },
  [ID.TOME_OF_COURAGE_ID_42371]: {
    inputCategory: 'bar-swap', // Explicit weapon or profession bar replacement.
    canCastConcurrently: true,
    castTimeMs: 0,
    effects: []
  },
  [ID.HEATED_REBUKE]: {
    // Debit on commitment before the earned Swift Scholar refund.
    resourceCost: 1,
    cost: { resource: 'tomePages', spendOn: 'castCommit' },
    castTimeMs: 200,
    effects: [
      {
        type: 'strike',
        coefficient: 0.45,
        hits: 1
      },
      {
        type: 'control',
        controlKind: 'pull'
      }
    ]
  },
  [ID.ASHES_OF_THE_JUST]: {
    // Accepted casts schedule the party grant at its application boundary during the animation.
    sideEffects: [{ on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'guardian.start-ashes' } }],
    // Debit on commitment before the earned Swift Scholar refund.
    resourceCost: 1,
    cost: { resource: 'tomePages', spendOn: 'castCommit' },
    castTimeMs: 880,
    // A committed cancellation preserves the separately scheduled Ashes grant.
    interruptCommitMs: 640,
    effects: []
  },
  [ID.ETERNAL_OASIS]: {
    // Debit on commitment before the earned Swift Scholar refund.
    resourceCost: 2,
    cost: { resource: 'tomePages', spendOn: 'castCommit' },
    castTimeMs: 200,
    effects: []
  },
  [ID.UNFLINCHING_CHARGE]: {
    // Debit on commitment before the earned Swift Scholar refund.
    resourceCost: 1,
    cost: { resource: 'tomePages', spendOn: 'castCommit' },
    castTimeMs: 200,
    effects: [
      {
        type: 'boon',
        boon: 'protection',
        duration: 2
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 6
      }
    ]
  },
  [ID.TOME_OF_JUSTICE]: {
    // Reopening preserves the shared dormancy and session controller.
    sideEffects: [{ on: 'castCommit', do: { type: 'guardian.open-justice' } }],
    inputCategory: 'bar-swap', // Explicit weapon or profession bar replacement.
    // Tome transitions change the available bar without cancelling the active animation.
    canCastConcurrently: true,
    castTimeMs: 0,
    effects: []
  },
  [ID.UNBROKEN_LINES]: {
    // Debit on commitment before the earned Swift Scholar refund.
    resourceCost: 2,
    cost: { resource: 'tomePages', spendOn: 'castCommit' },
    castTimeMs: 200,
    effects: [
      {
        type: 'buff',
        kind: 'toughness',
        duration: 5,
        stacks: 300
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 5
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 5
      },
      {
        type: 'boon',
        boon: 'aegis',
        duration: 4
      }
    ]
  },
  [ID.DESERT_BLOOM]: {
    // Debit on commitment before the earned Swift Scholar refund.
    resourceCost: 1,
    cost: { resource: 'tomePages', spendOn: 'castCommit' },
    castTimeMs: 200,
    effects: []
  },
  [ID.AZURE_SUN]: {
    // Debit on commitment before the earned Swift Scholar refund.
    resourceCost: 1,
    cost: { resource: 'tomePages', spendOn: 'castCommit' },
    castTimeMs: 200,
    effects: [
      {
        type: 'boon',
        boon: 'vigor',
        duration: 5
      },
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 6
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 5
      }
    ]
  }
});
