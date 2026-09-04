/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const WARRIOR_SLOT_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.THROW_BOLAS]: {
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 0.25,
        hits: 1
      }
    ]
  },
  [ID.SIGNET_OF_RAGE]: {
    quicknessCastTimeMs: 167,
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
  [ID.SHAKE_IT_OFF]: {
    quicknessCastTimeMs: 333,
    effects: []
  },
  [ID.STOMP]: {
    quicknessCastTimeMs: 500,
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
    quicknessCastTimeMs: 833,
    effects: [
      {
        type: 'boon',
        boon: 'resistance',
        duration: 6,
        stacks: 1
      }
    ]
  },
  [ID.ENDURE_PAIN]: {
    quicknessCastTimeMs: 333,
    effects: []
  },
  [ID.MENDING]: {
    cooldown: 12,
    quicknessCastTimeMs: 920,
    categories: ['Physical'],
    effects: []
  },
  [ID.TO_THE_LIMIT]: {
    cooldown: 24,
    quicknessCastTimeMs: 680,
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
    quicknessCastTimeMs: 333,
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
    quicknessCastTimeMs: 500,
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
        controlKind: 'daze',
        duration: 2
      }
    ]
  },
  [ID.BERSERKER_STANCE]: {
    quicknessCastTimeMs: 333,
    adrenalineGain: 7,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'boon',
        boon: 'resistance',
        duration: 1,
        stacks: 1
      }
    ]
  },
  [ID.BANNER_OF_DISCIPLINE]: {
    quicknessCastTimeMs: 500,
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
  [ID.BANNER_OF_TACTICS]: {
    quicknessCastTimeMs: 167,
    effects: [
      {
        type: 'boon',
        boon: 'stability',
        duration: 5,
        stacks: 5
      },
      {
        type: 'boon',
        boon: 'resistance',
        duration: 2,
        stacks: 1
      }
    ]
  },
  [ID.FEAR_ME]: {
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 6
      }
    ]
  },
  [ID.SIGNET_OF_FURY]: {
    cooldown: 16,
    quicknessCastTimeMs: 350,
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
  [ID.BALANCED_STANCE]: {
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'boon',
        boon: 'stability',
        duration: 1,
        stacks: 2
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.BATTLE_STANDARD]: {
    quicknessCastTimeMs: 1333,
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
    quicknessCastTimeMs: 667,
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
    quicknessCastTimeMs: 842,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 441.047619047619, coefficient: 1 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'control',
        atMs: 441.047619047619,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: 'knockback'
      }
    ]
  },
  [ID.BULLS_CHARGE]: {
    // Bull's Charge is a fixed 640 ms cast: unaffected by Quickness and, per the
    // exclusion set below, by Dual Wielding.
    castTimeMs: 640,
    unaffectedByQuickness: true,
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
        controlKind: 'knockdown',
        duration: 3
      }
    ]
  },
  [ID.BANNER_OF_DEFENSE]: {
    quicknessCastTimeMs: 167,
    effects: [
      {
        type: 'boon',
        boon: 'aegis',
        duration: 5,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 4,
        stacks: 1
      }
    ]
  },
  [ID.ON_MY_MARK]: {
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 15,
        duration: 6
      }
    ]
  },
  [ID.DEFIANT_STANCE]: {
    quicknessCastTimeMs: 500,
    effects: []
  }
});
