/** Explicit PvE skill mechanics owned by the Core Warrior module. */
import { WARRIOR_SKILL_IDS as ID } from '../data/ids.js';
import type { SkillFragment } from '../../../platform/engine/types.js';
export { WARRIOR_DODGE, WARRIOR_SWAP_WEAPONS } from './actions.js';
export const WARRIOR_CORE_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.EVISCERATE]: {
    implemented: true,
    cooldown: 8,
    castTimeMs: 0,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'boon',
        boon: 'might',
        duration: 5,
        stacks: 5
      },
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Eviscerate — Level 1 Damage'
      }
    ]
  },
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
  [ID.GREATSWORD_SWING]: {
    implemented: true,
    quicknessCastTimeMs: 400,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 8
      }
    ]
  },
  [ID.HAMMER_SWING]: {
    implemented: true,
    quicknessCastTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 1,
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.STAGGERING_BLOW]: {
    implemented: true,
    cooldown: 18,
    quicknessCastTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        comboFinishers: [
          {
            ownerId: 'warrior',
            finisherType: 'Whirl',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'control',
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: {
          controlKind: 'knockback'
        }
      }
    ]
  },
  [ID.RIFLE_BUTT]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'control',
        metadata: {
          controlKind: 'knockback'
        }
      }
    ]
  },
  [ID.SHIELD_BASH]: {
    implemented: true,
    quicknessCastTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'control',
        metadata: {
          controlKind: 'stun',
          duration: 2
        }
      }
    ]
  },
  [ID.SHIELD_STANCE]: {
    implemented: true,
    quicknessCastTimeMs: 2000,
    effects: []
  },
  [ID.HAMSTRING]: {
    interruptCommitMs: 0,
    implemented: true,
    quicknessCastTimeMs: 400,
    dualWieldCastTimeMs: 320,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        atMs: 240,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 6,
        atMs: 240,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 1,
        atMs: 240,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.SEVER_ARTERY]: {
    implemented: true,
    quicknessCastTimeMs: 360,
    dualWieldCastTimeMs: 280,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        atMs: 200,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 6,
        atMs: 200,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.GASH]: {
    implemented: true,
    quicknessCastTimeMs: 520,
    dualWieldCastTimeMs: 360,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        atMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 6,
        atMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.SAVAGE_LEAP]: {
    implemented: true,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Leap',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    quicknessCastTimeMs: 1000,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        atMs: 800,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 3,
        atMs: 800,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 5,
        atMs: 800,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
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
  [ID.CHOP]: {
    implemented: true,
    quicknessCastTimeMs: 167,
    effects: [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 1
      }
    ]
  },
  [ID.DOUBLE_CHOP]: {
    implemented: true,
    quicknessCastTimeMs: 167,
    effects: [
      {
        type: 'strike',
        coefficient: 0.45,
        hits: 1,
        name: 'Double Chop — First Chop Damage'
      },
      {
        type: 'strike',
        coefficient: 1.05,
        hits: 1,
        name: 'Double Chop — Second Chop Damage'
      }
    ]
  },
  [ID.TRIPLE_CHOP]: {
    implemented: true,
    quicknessCastTimeMs: 1000,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 2
      },
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 1,
        name: 'Triple Chop — Final chop damage.'
      }
    ]
  },
  [ID.SHAKE_IT_OFF]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    effects: []
  },
  [ID.GREATSWORD_SLICE]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 1.05,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 8
      }
    ]
  },
  [ID.BRUTAL_STRIKE]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      }
    ]
  },
  [ID.ARCING_SLICE]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        coefficientModifiers: [
          {
            kind: 'target-health-below',
            threshold: 0.5,
            multiplier: 1.5
          }
        ]
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 8,
        stacks: 1
      }
    ]
  },
  [ID.MACE_SMASH]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1
      }
    ]
  },
  [ID.MACE_BASH]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1
      }
    ]
  },
  [ID.PULVERIZE]: {
    implemented: true,
    quicknessCastTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 5
      }
    ]
  },
  [ID.ARCING_ARROW]: {
    implemented: true,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Blast',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    quicknessCastTimeMs: 560,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        atMs: 600,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 5,
        atMs: 600,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.HAMMER_BASH]: {
    implemented: true,
    quicknessCastTimeMs: 640,
    effects: [
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 1,
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.HAMMER_SMASH]: {
    implemented: true,
    interruptCommitMs: 320,
    quicknessCastTimeMs: 440,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.FIERCE_BLOW]: {
    implemented: true,
    interruptCommitMs: 600,
    cooldown: 6,
    quicknessCastTimeMs: 880,
    handlerId: 'warrior.fierce-blow',
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1,
        atMs: 600,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 4,
        atMs: 600,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.EARTHSHAKER]: {
    implemented: true,
    skillWeapon: 'Hammer',
    cooldown: 8,
    quicknessCastTimeMs: 1000,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        coefficient: 2.75,
        hits: 1,
        atMs: 840,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        comboFinishers: [
          {
            ownerId: 'warrior',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'control',
        atMs: 840,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: {
          controlKind: 'stun',
          duration: 1
        }
      }
    ]
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
  [ID.CHARGE]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 20,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'quickness',
        duration: 2,
        stacks: 1
      }
    ]
  },
  [ID.CALL_OF_VALOR]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'boon',
        boon: 'vigor',
        duration: 10,
        stacks: 1
      }
    ]
  },
  [ID.KILL_SHOT]: {
    implemented: true,
    quicknessCastTimeMs: 833,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        coefficient: 2.25,
        hits: 1,
        name: 'Kill Shot — Level 1 Damage'
      }
    ]
  },
  [ID.THROW_AXE]: {
    implemented: true,
    ammo: 2,
    ammoRecharge: 10,
    cooldown: 10,
    ammoCastLockout: 1,
    quicknessCastTimeMs: 360,
    dualWieldCastTimeMs: 240,
    effects: [
      {
        type: 'strike',
        coefficient: 0.85,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 4
      }
    ]
  },
  [ID.WHIRLING_AXE]: {
    implemented: true,
    interruptMode: 'per-packet',
    cooldown: 15,
    quicknessCastTimeMs: 2500,
    dualWieldCastTimeMs: 2040,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 15 }, (_, index) => ({
          atMs: 300 + index * 150,
          coefficient: 0.5592
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        comboFinishers: [
          {
            ownerId: 'warrior',
            finisherType: 'Whirl',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      }
    ]
  },
  [ID.RIPOSTE]: {
    implemented: true,
    quicknessCastTimeMs: 1500,
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
  [ID.SKULL_CRACK]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      }
    ]
  },
  [ID.TREMOR]: {
    implemented: true,
    // Tremor refreshes Crushing Blow when its cast completes.
    mechanicTriggers: [
      {
        type: 'warrior.core.reset-crushing-blow',
        timingAnchor: 'castEnd'
      }
    ],
    quicknessCastTimeMs: 560,
    dualWieldCastTimeMs: 400,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 440, coefficient: 1.25 },
          { atMs: 480, coefficient: 1.25 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'control',
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'knockdown',
          duration: 3
        }
      }
    ]
  },
  [ID.VOLLEY]: {
    implemented: true,
    quicknessCastTimeMs: 1667,
    effects: [
      {
        type: 'strike',
        coefficient: 4,
        hits: 5
      }
    ]
  },
  [ID.DUAL_STRIKE]: {
    implemented: true,
    cooldown: 12,
    castTimeMs: 500,
    dualWieldCastTimeMs: 400,
    unaffectedByQuickness: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 350, coefficient: 1.175 },
          { atMs: 350, coefficient: 1.175 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'quickness',
        duration: 2,
        stacks: 1,
        atMs: 350,
        timingAnchor: 'castStart',
        timingScale: 'cast'
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
  [ID.CYCLONE_AXE]: {
    implemented: true,
    cooldown: 6,
    quicknessCastTimeMs: 400,
    dualWieldCastTimeMs: 280,
    effects: [
      {
        type: 'strike',
        coefficient: 1.76,
        hits: 2,
        comboFinishers: [
          {
            ownerId: 'warrior',
            finisherType: 'Whirl',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 2,
        stacks: 1
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 3,
        duration: 8
      }
    ]
  },
  [ID.EVISCERATE_ID_14422]: {
    implemented: true,
    cooldown: 8,
    castTimeMs: 0,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Eviscerate — Level 1 Damage'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 5,
        stacks: 5
      }
    ]
  },
  [ID.SKULL_CRACK_ID_14425]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      }
    ]
  },
  [ID.DUAL_SHOT]: {
    implemented: true,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Projectile',
        chance: 0.2,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    quicknessCastTimeMs: 840,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 560, coefficient: 0.525 },
          { atMs: 600, coefficient: 0.525 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.FIERCE_SHOT]: {
    implemented: true,
    quicknessCastTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.WHIRLING_STRIKE]: {
    implemented: true,
    quicknessCastTimeMs: 500,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      }
    ]
  },
  [ID.RUSH]: {
    implemented: true,
    quicknessCastTimeMs: 1000,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1
      }
    ]
  },
  [ID.WHIRLWIND_ATTACK]: {
    implemented: true,
    quicknessCastTimeMs: 200,
    effects: [
      {
        type: 'strike',
        coefficient: 0.665,
        hits: 1
      }
    ]
  },
  [ID.FORCEFUL_SHOT]: {
    implemented: true,
    quicknessCastTimeMs: 1167,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    effects: [
      {
        type: 'strike',
        coefficient: 2.25,
        hits: 1,
        name: 'Forceful Shot — Level 1 Damage'
      }
    ]
  },
  [ID.EXPLOSIVE_SHELL]: {
    implemented: true,
    quicknessCastTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 5
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 10
      }
    ]
  },
  [ID.KILL_SHOT_ID_14473]: {
    implemented: true,
    quicknessCastTimeMs: 833,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    effects: [
      {
        type: 'strike',
        coefficient: 2.25,
        hits: 1,
        name: 'Kill Shot — Level 1 Damage'
      }
    ]
  },
  [ID.KILL_SHOT_ID_14474]: {
    implemented: true,
    quicknessCastTimeMs: 833,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    effects: [
      {
        type: 'strike',
        coefficient: 2.25,
        hits: 1,
        name: 'Kill Shot — Level 1 Damage'
      }
    ]
  },
  [ID.KILL_SHOT_ID_14475]: {
    implemented: true,
    quicknessCastTimeMs: 833,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    effects: [
      {
        type: 'strike',
        coefficient: 2.25,
        hits: 1,
        name: 'Kill Shot — Level 1 Damage'
      }
    ]
  },
  [ID.SIGNET_OF_STAMINA]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    effects: []
  },
  [ID.HAMMER_SHOCK]: {
    implemented: true,
    cooldown: 8,
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1,
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 7,
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
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
  [ID.IMPALE]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 5,
        duration: 8
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 1,
        applications: 5,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.RIP]: {
    implemented: true,
    quicknessCastTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 5,
        stacks: 10
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
  [ID.POMMEL_BASH]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1
      },
      {
        type: 'control',
        metadata: {
          controlKind: 'daze',
          duration: 1
        }
      }
    ]
  },
  [ID.PIN_DOWN]: {
    implemented: true,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Projectile',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    quicknessCastTimeMs: 680,
    effects: [
      {
        type: 'strike',
        coefficient: 0.44,
        hits: 1,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 6,
        duration: 12,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 3,
        atMs: 560,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SMOLDERING_ARROW]: {
    implemented: true,
    ammo: 3,
    ammoRecharge: 16,
    ammoCastLockout: 0.5,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Projectile',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    quicknessCastTimeMs: 160,
    effects: [
      {
        type: 'strike',
        coefficient: 0.2,
        hits: 1
      },
      {
        type: 'blind',
        metadata: {
          duration: 5
        }
      },
      {
        type: 'control',
        metadata: {
          controlKind: 'daze',
          duration: 1
        }
      }
    ]
  },
  [ID.COMBUSTIVE_SHOT]: {
    interruptCommitMs: 0,
    implemented: true,
    comboFields: [
      {
        ownerId: 'warrior',
        fieldType: 'Fire',
        duration: 3,
        startAnchor: 'castEnd'
      }
    ],
    burstFieldDurations: [3, 6, 9],
    quicknessCastTimeMs: 520,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: 'warrior.combustive-shot',
    effects: []
  },
  [ID.COUNTERBLOW]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    adrenalineGain: 5,
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 8
      }
    ]
  },
  [ID.BLADETRAIL]: {
    implemented: true,
    quicknessCastTimeMs: 560,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 517, coefficient: 1.5 },
          { atMs: 1517, coefficient: 1.5 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.BACKBREAKER]: {
    implemented: true,
    cooldown: 25,
    // Backbreaker refreshes Fierce Blow when its cast completes.
    mechanicTriggers: [
      {
        type: 'warrior.core.reset-fierce-blow',
        timingAnchor: 'castEnd'
      }
    ],
    quicknessCastTimeMs: 880,
    effects: [
      {
        type: 'strike',
        coefficient: 2.25,
        hits: 1,
        atMs: 680,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        atMs: 680,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: {
          controlKind: 'knockdown',
          duration: 3
        }
      }
    ]
  },
  [ID.EARTHSHAKER_ID_14512]: {
    implemented: true,
    skillWeapon: 'Hammer',
    cooldown: 8,
    quicknessCastTimeMs: 1000,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    effects: [
      {
        type: 'strike',
        coefficient: 2.75,
        hits: 1,
        atMs: 840,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        comboFinishers: [
          {
            ownerId: 'warrior',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'control',
        atMs: 840,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        metadata: {
          controlKind: 'stun',
          duration: 1
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
  [ID.CRUSHING_BLOW]: {
    implemented: true,
    quicknessCastTimeMs: 560,
    dualWieldCastTimeMs: 400,
    interruptCommitMs: 440,
    effects: [
      {
        type: 'strike',
        coefficient: 2.25,
        hits: 1,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 6,
        stacks: 5,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 6,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.FAN_OF_FIRE]: {
    quicknessCastTimeMs: 560,
    // The arrows commit at 240 ms, but canceling after release retains the
    // remaining animation as aftercast for ordinary cast-time skills.
    interruptCommitMs: 240,
    retainsCastLockoutAfterInterrupt: true,
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.32,
        hits: 3,
        atMs: 240,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 3,
        duration: 3,
        atMs: 240,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.COMBUSTIVE_SHOT_ID_14520]: {
    interruptCommitMs: 0,
    implemented: true,
    comboFields: [
      {
        ownerId: 'warrior',
        fieldType: 'Fire',
        duration: 3,
        startAnchor: 'castEnd'
      }
    ],
    quicknessCastTimeMs: 520,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 520, coefficient: 0.5 },
          { atMs: 3520, coefficient: 0.5 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 520,
            condition: 'Burning',
            stacks: 1,
            duration: 5
          },
          {
            atMs: 3520,
            condition: 'Burning',
            stacks: 1,
            duration: 5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
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
  [ID.FORCEFUL_SHOT_ID_14544]: {
    implemented: true,
    quicknessCastTimeMs: 1167,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        coefficient: 2.25,
        hits: 1,
        name: 'Forceful Shot — Level 1 Damage'
      }
    ]
  },
  [ID.ARCING_SLICE_ID_14545]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        coefficientModifiers: [
          {
            kind: 'target-health-below',
            threshold: 0.5,
            multiplier: 0.91
          }
        ]
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 8,
        stacks: 1
      }
    ]
  },
  [ID.TACTICAL_BLOW]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    adrenalineGain: 5,
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 8
      }
    ]
  },
  [ID.WHIRLING_STRIKE_ID_14549]: {
    implemented: true,
    quicknessCastTimeMs: 500,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      }
    ]
  },
  [ID.HUNDRED_BLADES]: {
    implemented: true,
    interruptMode: 'per-packet',
    quicknessCastTimeMs: 2440,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 314.945652173913, coefficient: 0.775 },
          { atMs: 480.706521739131, coefficient: 0.775 },
          { atMs: 679.619565217393, coefficient: 0.775 },
          { atMs: 878.532608695653, coefficient: 0.775 },
          { atMs: 1160.32608695652, coefficient: 0.775 },
          { atMs: 1309.51086956522, coefficient: 0.775 },
          { atMs: 1558.152173913046, coefficient: 0.775 },
          { atMs: 1790.217391304347, coefficient: 0.775 },
          {
            atMs: 2270.92391304348,
            coefficient: 1.5,
            name: 'Hundred Blades — Final Strike Damage'
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.ADRENALINE_RUSH]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    adrenalineGain: 3,
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
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
  },
  [ID.BLAZE_BREAKER]: {
    implemented: true,
    cooldown: 12,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Blast',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    waves: 5,
    totalCoefficient: 2,
    maximumHitsPerTarget: 1,
    quicknessCastTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1,
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 6,
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 3,
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.FLAMES_OF_WAR]: {
    interruptCommitMs: 0,
    implemented: true,
    cooldown: 20,
    comboFields: [
      {
        ownerId: 'warrior',
        fieldType: 'Fire',
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    quicknessCastTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        atMs: 5480,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 480,
            condition: 'Burning',
            stacks: 1,
            duration: 2
          },
          {
            atMs: 1480,
            condition: 'Burning',
            stacks: 1,
            duration: 2
          },
          {
            atMs: 2480,
            condition: 'Burning',
            stacks: 1,
            duration: 2
          },
          {
            atMs: 3480,
            condition: 'Burning',
            stacks: 1,
            duration: 2
          },
          {
            atMs: 4480,
            condition: 'Burning',
            stacks: 1,
            duration: 2
          },
          {
            atMs: 5480,
            condition: 'Burning',
            stacks: 2,
            duration: 6
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.BRUTAL_SHOT]: {
    implemented: true,
    quicknessCastTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 8,
        duration: 12
      }
    ]
  },
  [ID.KEEN_STRIKE]: {
    implemented: true,
    interruptCommitMs: 280,
    quicknessCastTimeMs: 440,
    dualWieldCastTimeMs: 320,
    effects: [
      {
        type: 'strike',
        coefficient: 1.05,
        hits: 1,
        atMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 5,
        stacks: 1,
        atMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.FOCUSED_SLASH]: {
    implemented: true,
    quicknessCastTimeMs: 360,
    dualWieldCastTimeMs: 240,
    effects: [
      {
        type: 'strike',
        coefficient: 0.65,
        hits: 1,
        atMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.PRECISE_CUT]: {
    implemented: true,
    quicknessCastTimeMs: 320,
    dualWieldCastTimeMs: 240,
    effects: [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 1,
        atMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.WASTRELS_RUIN]: {
    implemented: true,
    cooldown: 12,
    quicknessCastTimeMs: 400,
    dualWieldCastTimeMs: 320,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      }
    ]
  },
  [ID.DISRUPTING_STAB]: {
    implemented: true,
    quicknessCastTimeMs: 440,
    dualWieldCastTimeMs: 320,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        atMs: 160,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'control',
        atMs: 160,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        metadata: {
          controlKind: 'daze'
        }
      }
    ]
  },
  [ID.HUSHBLADE]: {
    implemented: true,
    ammo: 2,
    ammoRecharge: 12,
    cooldown: 12,
    ammoCastLockout: 1,
    quicknessCastTimeMs: 500,
    dualWieldCastTimeMs: 400,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'control',
        metadata: {
          controlKind: 'daze'
        }
      }
    ]
  },
  [ID.BREACHING_STRIKE]: {
    implemented: true,
    interruptCommitMs: 758,
    skillWeapon: 'Dagger',
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Leap',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    cooldown: 8,
    castTimeMs: 842,
    unaffectedByQuickness: true,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        atMs: 758,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'custom',
        eventType: 'warrior.boon-removal',
        atMs: 758,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        event: {
          attemptedBoonRemovals: 2
        }
      }
    ]
  },
  [ID.AURA_SLICER]: {
    implemented: true,
    castTimeMs: 750,
    unaffectedByQuickness: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 1.5
      }
    ]
  },
  [ID.GUNSTINGER]: {
    implemented: true,
    ammo: 0,
    ammoRecharge: 0,
    cooldown: 15,
    // Gunstinger restores three Dragon's Roar charges after completion.
    mechanicTriggers: [
      {
        type: 'warrior.core.restore-dragons-roar-ammo',
        timingAnchor: 'castEnd',
        count: 3
      }
    ],
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 8
      },
      {
        type: 'boon',
        boon: 'aegis',
        duration: 3,
        stacks: 1
      }
    ]
  },
  [ID.DRAGONS_ROAR]: {
    implemented: true,
    ammo: 6,
    ammoRecharge: 5,
    cooldown: 5,
    ammoCastLockout: 1,
    quicknessCastTimeMs: 560,
    handlerId: 'warrior.dragons-roar',
    effects: []
  },
  [ID.BREACHING_STRIKE_ID_69433]: {
    implemented: true,
    interruptCommitMs: 758,
    skillWeapon: 'Dagger',
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Leap',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    cooldown: 8,
    castTimeMs: 842,
    unaffectedByQuickness: true,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        atMs: 758,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'custom',
        eventType: 'warrior.boon-removal',
        atMs: 758,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        event: {
          attemptedBoonRemovals: 2
        }
      }
    ]
  },
  [ID.LINE_BREAKER]: {
    implemented: true,
    quicknessCastTimeMs: 1167,
    effects: [
      {
        type: 'boon',
        boon: 'protection',
        duration: 4,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'aegis',
        duration: 4,
        stacks: 1
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 5
      }
    ]
  },
  [ID.DEFIANT_ROAR]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    adrenalineGain: 10,
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'boon',
        boon: 'resolution',
        duration: 6,
        stacks: 1
      }
    ]
  },
  [ID.PATH_TO_VICTORY]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.PATH_TO_VICTORY_ID_71932]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.PATH_TO_VICTORY_ID_71950]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.REVERSE_STRIKE]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1
      }
    ]
  },
  [ID.VALIANT_LEAP]: {
    implemented: true,
    quicknessCastTimeMs: 500,
    adrenalineGain: 5,
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        coefficient: 1.25,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 5
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 4,
        stacks: 1
      }
    ]
  },
  [ID.BALANCED_STRIKE]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    effects: [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 1
      }
    ]
  },
  [ID.SNAP_PULL]: {
    implemented: true,
    quicknessCastTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 6,
        duration: 6
      },
      {
        type: 'control',
        metadata: {
          controlKind: 'pull'
        }
      }
    ]
  },
  [ID.PATH_TO_VICTORY_ID_72029]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.INSPIRING_WHIRL]: {
    implemented: true,
    quicknessCastTimeMs: 500,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      }
    ]
  },
  [ID.MAIMING_SPEAR]: {
    implemented: true,
    quicknessCastTimeMs: 480,
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 1,
        name: 'Maiming Spear — Initial Strike Damage',
        atMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        // Base aftershock coefficient is 0.75; the aftershock deals 50% more to
        // the foe closest to the epicenter (per the skill fact). On a single
        // target that foe is always the golem, so the effective coefficient is
        // 0.75 * 1.5 = 1.125. The epicenter bonus is folded in here because the
        // simulator has no target-position model to gate it on.
        coefficient: 1.125,
        hits: 1,
        name: 'Maiming Spear — Aftershock Damage',
        atMs: 1517,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        comboFinishers: [
          {
            ownerId: 'warrior',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {}
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 3
      }
    ]
  },
  [ID.HARRIERS_TOSS]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 6
      },
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1
      }
    ]
  },
  [ID.MIGHTY_THROW]: {
    implemented: true,
    handlerId: 'warrior.mighty-throw',
    quicknessCastTimeMs: 640,
    effects: [
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        name: 'Mighty Throw — Spear Damage',
        atMs: 480,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        coefficient: 0.9,
        hits: 1,
        name: 'Mighty Throw — Shard Damage',
        atMs: 466.666666666667,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.DISRUPTING_THROW]: {
    implemented: true,
    quicknessCastTimeMs: 520,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        atMs: 399.75,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 2
      },
      {
        type: 'control',
        metadata: {
          controlKind: 'daze',
          duration: 3
        }
      }
    ]
  },
  [ID.SPEARMARSHALS_SUPPORT]: {
    implemented: true,
    quicknessCastTimeMs: 520,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 967, coefficient: 0.5 },
          { atMs: 1167, coefficient: 0.5 },
          { atMs: 1367, coefficient: 0.5 },
          { atMs: 1567, coefficient: 0.5 },
          { atMs: 1767, coefficient: 0.5 },
          { atMs: 1967, coefficient: 0.5 },
          { atMs: 2167, coefficient: 0.5 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.HARRIERS_TOSS_ID_73006]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 6
      },
      {
        type: 'strike',
        coefficient: 3.5,
        hits: 1
      }
    ]
  },
  [ID.SPEAR_SWIPE]: {
    implemented: true,
    quicknessCastTimeMs: 500,
    effects: [
      {
        type: 'control',
        metadata: {
          controlKind: 'launch'
        }
      },
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      }
    ]
  },
  [ID.HARRIERS_TOSS_ID_73024]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 6
      }
    ]
  },
  [ID.HARRIERS_TOSS_ID_73042]: {
    implemented: true,
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 5,
        duration: 6
      },
      {
        type: 'strike',
        coefficient: 3,
        hits: 1
      }
    ]
  },
  [ID.BLOODTHIRSTER]: {
    implemented: true,
    skillWeapon: 'Sword',
    quicknessCastTimeMs: 500,
    dualWieldCastTimeMs: 400,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 6,
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.REND]: {
    interruptCommitMs: 0,
    implemented: true,
    quicknessCastTimeMs: 960,
    dualWieldCastTimeMs: 720,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      },
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        name: 'Rend — Follow-Up Damage',
        atMs: 880,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 2,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 6,
        duration: 6,
        atMs: 880,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.BLOODTHIRSTER_ID_80263]: {
    implemented: true,
    skillWeapon: 'Sword',
    quicknessCastTimeMs: 500,
    dualWieldCastTimeMs: 400,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 6,
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  }
});
