/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/content/professions/warrior/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const WARRIOR_SLOT_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.THROW_BOLAS]: {
    implemented: true,
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
    implemented: true,
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
  [ID.FRENZY]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'boon',
        boon: 'quickness',
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 6,
        stacks: 10
      }
    ]
  },
  [ID.SHAKE_IT_OFF]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    effects: []
  },
  [ID.STOMP]: {
    implemented: true,
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
        metadata: {
          controlKind: 'launch'
        }
      }
    ]
  },
  [ID.HEALING_SIGNET]: {
    implemented: true,
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
    implemented: true,
    quicknessCastTimeMs: 333,
    effects: []
  },
  [ID.MENDING]: {
    implemented: true,
    cooldown: 12,
    quicknessCastTimeMs: 920,
    categories: ['Physical'],
    effects: []
  },
  [ID.TO_THE_LIMIT]: {
    implemented: true,
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
    handlerId: 'warrior.resource',
    effects: []
  },
  [ID.FOR_GREAT_JUSTICE]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'boon',
        boon: 'fury',
        duration: 8,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 25,
        stacks: 6
      }
    ]
  },
  [ID.SIGNET_OF_MIGHT]: {
    implemented: true,
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
    implemented: true,
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
        metadata: {
          controlKind: 'daze',
          duration: 2
        }
      }
    ]
  },
  [ID.BERSERKER_STANCE]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    adrenalineGain: 7,
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
    implemented: true,
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
    implemented: true,
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
    implemented: true,
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
    implemented: true,
    cooldown: 16,
    quicknessCastTimeMs: 350,
    dualWieldCastTimeMs: 280,
    adrenalineGain: 30,
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
    implemented: true,
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
  [ID.DOLYAK_SIGNET]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'boon',
        boon: 'stability',
        duration: 8,
        stacks: 10
      }
    ]
  },
  [ID.BATTLE_STANDARD]: {
    implemented: true,
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
  [ID.SIGNET_OF_STAMINA]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    effects: []
  },
  [ID.RAMPAGE]: {
    implemented: true,
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
    implemented: true,
    quicknessCastTimeMs: 842,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        atMs: 441.047619047619,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'control',
        atMs: 441.047619047619,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'knockback'
        }
      }
    ]
  },
  [ID.BULLS_CHARGE]: {
    implemented: true,
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
        metadata: {
          controlKind: 'knockdown',
          duration: 3
        }
      }
    ]
  },
  [ID.BANNER_OF_DEFENSE]: {
    implemented: true,
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
    implemented: true,
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
    implemented: true,
    quicknessCastTimeMs: 500,
    effects: []
  }
});
