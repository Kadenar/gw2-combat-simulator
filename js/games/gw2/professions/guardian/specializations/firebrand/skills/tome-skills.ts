/**
 * Owns Firebrand tome and tome-page skill fragments.
 * Persistent tome page state and behavior remain under `mechanics/`.
 */
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { impactEffects } from '#gw2/platform/engine/effects/factories.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const FIREBRAND_TOME_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SCORCHED_AFTERMATH]: {
    castTimeMs: 920,
    // The Fire combo field lasts four seconds from the first pulse.
    comboFields: [{ ownerId: 'guardian', fieldType: 'Fire', duration: 4, startMs: 440, startAnchor: 'castStart' }],
    // Custom: Spends pages and applies tome-specific state changes; see `firebrand/mechanics/tomes.ts`.
    handlerId: 'guardian.tome-page',
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
    castTimeMs: 480,
    // Custom: Spends pages and applies tome-specific state changes; see `firebrand/mechanics/tomes.ts`.
    handlerId: 'guardian.tome-page',
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
    castTimeMs: 200,
    // Custom: Spends pages and applies tome-specific state changes; see `firebrand/mechanics/tomes.ts`.
    handlerId: 'guardian.tome-page',
    effects: []
  },
  [ID.STALWART_STAND]: {
    castTimeMs: 200,
    // Custom: Spends pages and applies tome-specific state changes; see `firebrand/mechanics/tomes.ts`.
    handlerId: 'guardian.tome-page',
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
    castTimeMs: 680,
    // A cancel after commitment retains the completed page use and its effects.
    interruptCommitMs: 480,
    // Custom: Spends pages and applies tome-specific state changes; see `firebrand/mechanics/tomes.ts`.
    handlerId: 'guardian.tome-page',
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
    // Tome transitions change the available bar without cancelling the active animation.
    canCastConcurrently: true,
    castTimeMs: 0,
    // Custom: Closes the active tome and updates tome state; see `firebrand/mechanics/tomes.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    handlerId: 'guardian.stow-tome',
    effects: []
  },
  [ID.TOME_OF_RESOLVE]: {
    inputCategory: 'bar-swap', // Explicit weapon or profession bar replacement.
    // Tome transitions change the available bar without cancelling the active animation.
    canCastConcurrently: true,
    castTimeMs: 0,
    // Custom: Activates the virtue and updates passive/readiness state; see `core/mechanics/virtues.ts`.
    handlerId: 'guardian.virtue',
    effects: []
  },
  [ID.VALIANT_BULWARK]: {
    castTimeMs: 200,
    // Custom: Spends pages and applies tome-specific state changes; see `firebrand/mechanics/tomes.ts`.
    handlerId: 'guardian.tome-page',
    effects: []
  },
  [ID.DARING_CHALLENGE]: {
    castTimeMs: 200,
    // Custom: Spends pages and applies tome-specific state changes; see `firebrand/mechanics/tomes.ts`.
    handlerId: 'guardian.tome-page',
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
    castTimeMs: 200,
    // Custom: Spends pages and applies tome-specific state changes; see `firebrand/mechanics/tomes.ts`.
    handlerId: 'guardian.tome-page',
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
    inputCategory: 'bar-swap', // Explicit weapon or profession bar replacement.
    canCastConcurrently: true,
    castTimeMs: 0,
    // Custom: Activates the virtue and updates passive/readiness state; see `core/mechanics/virtues.ts`.
    handlerId: 'guardian.virtue',
    effects: []
  },
  [ID.TOME_OF_COURAGE_ID_42371]: {
    inputCategory: 'bar-swap', // Explicit weapon or profession bar replacement.
    canCastConcurrently: true,
    castTimeMs: 0,
    // Custom: Activates the virtue and updates passive/readiness state; see `core/mechanics/virtues.ts`.
    handlerId: 'guardian.virtue',
    effects: []
  },
  [ID.HEATED_REBUKE]: {
    castTimeMs: 200,
    // Custom: Spends pages and applies tome-specific state changes; see `firebrand/mechanics/tomes.ts`.
    handlerId: 'guardian.tome-page',
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
    castTimeMs: 880,
    // Commitment precedes the animation end; the Ashes grant keeps its separate application time.
    interruptCommitMs: 640,
    // Custom: Spends pages and applies tome-specific state changes; see `firebrand/mechanics/tomes.ts`.
    handlerId: 'guardian.tome-page',
    effects: []
  },
  [ID.ETERNAL_OASIS]: {
    castTimeMs: 200,
    // Custom: Spends pages and applies tome-specific state changes; see `firebrand/mechanics/tomes.ts`.
    handlerId: 'guardian.tome-page',
    effects: []
  },
  [ID.UNFLINCHING_CHARGE]: {
    castTimeMs: 200,
    // Custom: Spends pages and applies tome-specific state changes; see `firebrand/mechanics/tomes.ts`.
    handlerId: 'guardian.tome-page',
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
    inputCategory: 'bar-swap', // Explicit weapon or profession bar replacement.
    // Tome transitions change the available bar without cancelling the active animation.
    canCastConcurrently: true,
    castTimeMs: 0,
    // Custom: Activates the virtue and updates passive/readiness state; see `core/mechanics/virtues.ts`.
    handlerId: 'guardian.virtue',
    effects: []
  },
  [ID.UNBROKEN_LINES]: {
    castTimeMs: 200,
    // Custom: Spends pages and applies tome-specific state changes; see `firebrand/mechanics/tomes.ts`.
    handlerId: 'guardian.tome-page',
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
    castTimeMs: 200,
    // Custom: Spends pages and applies tome-specific state changes; see `firebrand/mechanics/tomes.ts`.
    handlerId: 'guardian.tome-page',
    effects: []
  },
  [ID.AZURE_SUN]: {
    castTimeMs: 200,
    // Custom: Spends pages and applies tome-specific state changes; see `firebrand/mechanics/tomes.ts`.
    handlerId: 'guardian.tome-page',
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
