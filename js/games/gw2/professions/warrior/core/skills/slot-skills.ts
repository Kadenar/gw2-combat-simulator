/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { impactEffects } from '#gw2/platform/engine/effects/factories.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const WARRIOR_SLOT_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.THROW_BOLAS]: {
    castTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 0.25,
        hits: 1
      }
    ]
  },
  [ID.SIGNET_OF_RAGE]: {
    castTimeMs: 167,
    dualWieldCastTimeMs: 160,
    effects: [
      {
        type: 'boon',
        boon: 'fury',
        duration: 25,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 25,
        stacks: 5
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 25,
        stacks: 1
      }
    ]
  },
  [ID.STOMP]: {
    castTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 0.75,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 6,
        stacks: 1
      },
      {
        type: 'control',
        controlKind: 'launch'
      }
    ]
  },
  [ID.HEALING_SIGNET]: {
    castTimeMs: 833,
    effects: [
      {
        type: 'boon',
        boon: 'resistance',
        duration: 6,
        stacks: 1
      }
    ]
  },
  [ID.MENDING]: {
    cooldown: 12,
    castTimeMs: 920,
    categories: ['Physical'],
    effects: []
  },
  [ID.TO_THE_LIMIT]: {
    cooldown: 24,
    castTimeMs: 680,
    // The heal restores two dodge bars when its cast completes.
    mechanicTriggers: [
      {
        type: 'warrior.core.restore-endurance',
        timingAnchor: 'castEnd',
        count: 100
      }
    ],
    adrenalineGain: 30,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
    handlerId: 'warrior.resource',
    effects: []
  },
  [ID.SIGNET_OF_MIGHT]: {
    cooldown: 20,
    castTimeMs: 333,
    effects: [
      {
        type: 'boon',
        boon: 'might',
        duration: 6,
        stacks: 10
      }
    ]
  },
  [ID.BANNER_OF_STRENGTH]: {
    castTimeMs: 500,
    effects: [
      {
        type: 'boon',
        boon: 'might',
        duration: 10,
        stacks: 2
      },
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      },
      {
        type: 'control',
        controlKind: 'daze'
      }
    ]
  },
  [ID.BANNER_OF_DISCIPLINE]: {
    castTimeMs: 500,
    effects: [
      {
        type: 'boon',
        boon: 'fury',
        duration: 4,
        stacks: 1
      },
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 8
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 10
      }
    ]
  },
  [ID.SIGNET_OF_FURY]: {
    cooldown: 16,
    castTimeMs: 350,
    dualWieldCastTimeMs: 280,
    adrenalineGain: 30,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'buff',
        kind: 'signet-of-fury-active',
        duration: 4,
        atMs: 40,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        stacks: 1
      }
    ]
  },
  [ID.BATTLE_STANDARD]: {
    castTimeMs: 1333,
    effects: [
      {
        type: 'strike',
        coefficient: 4,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 12,
        stacks: 2
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 12,
        stacks: 1
      }
    ]
  },
  [ID.RAMPAGE]: {
    castTimeMs: 667,
    effects: [
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 3,
        stacks: 2
      }
    ]
  },
  [ID.KICK]: {
    castTimeMs: 842,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 1
      },
      {
        type: 'control',
        controlKind: 'knockback'
      }
    ])
  },
  [ID.BULLS_CHARGE]: {
    // Bull's Charge is a fixed 640 ms cast: unaffected by Quickness and, per the
    // exclusion set below, by Dual Wielding.
    castTimeMs: 640,

    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Leap',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      },
      {
        type: 'control',
        controlKind: 'knockdown'
      }
    ]
  },
  [ID.DEFIANT_STANCE]: {
    castTimeMs: 500,
    effects: []
  }
});
