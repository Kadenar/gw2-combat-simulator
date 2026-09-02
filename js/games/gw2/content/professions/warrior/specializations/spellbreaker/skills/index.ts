/** Explicit PvE skill mechanics owned by the Spellbreaker Warrior module. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/content/professions/warrior/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';
export const SPELLBREAKER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SILENCER]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 1
      },
      {
        type: 'control',
        controlKind: 'stun',
        duration: 1
      }
    ],
    adrenalineCost: 10,
    burstTier: 1,
    adrenalineGain: 10,
    burst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/skills/execution.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.EARTHSHAKER_ID_40601]: {
    implemented: true,
    skillWeapon: 'Hammer',
    cooldown: 8,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 840, coefficient: 2.75 }],
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
        controlKind: 'stun',
        duration: 1
      }
    ],
    quicknessCastTimeMs: 1000,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/skills/execution.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.NATURAL_HEALING]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 667
  },
  [ID.SKULL_CRACK_ID_41110]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'control',
        controlKind: 'stun',
        duration: 1
      }
    ],
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/skills/execution.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.BOON_CRUSHER]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 2,
        atMs: 0
      }
    ],
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/skills/execution.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.FORCEFUL_SHOT_ID_41330]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 2.25,
        hits: 1
      }
    ],
    quicknessCastTimeMs: 1167,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/skills/execution.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.WOUNDING_STRIKE]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 8
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 5,
        duration: 8
      }
    ],
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/skills/execution.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.WHIRLING_STRIKE_ID_41746]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'control',
        controlKind: 'stun',
        duration: 1
      }
    ],
    quicknessCastTimeMs: 500,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/skills/execution.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.IMMINENT_THREAT]: {
    implemented: true,
    effects: [
      {
        type: 'boon',
        boon: 'resolution',
        duration: 5,
        stacks: 1
      }
    ],
    quicknessCastTimeMs: 167,
    adrenalineGain: 3,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/skills/execution.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.ARCING_SLICE_ID_42707]: {
    implemented: true,
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
    ],
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/skills/execution.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.COMBUSTIVE_SHOT_ID_42803]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 2,
        atMs: 0
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 2,
        duration: 5
      }
    ],
    quicknessCastTimeMs: 500,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/skills/execution.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.BREAK_ENCHANTMENTS]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'custom',
        eventType: 'warrior.boon-removal',
        event: {
          attemptedBoonRemovals: 4
        }
      }
    ],
    quicknessCastTimeMs: 167
  },
  [ID.FLEETING_STABILITY]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1
      },
      {
        type: 'control',
        controlKind: 'stun',
        duration: 2
      }
    ],
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/skills/execution.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.EVISCERATE_ID_43566]: {
    implemented: true,
    castTimeMs: 0,
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
        hits: 1
      }
    ],
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/skills/execution.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.SIGHT_BEYOND_SIGHT]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333
  },
  [ID.FULL_COUNTER]: {
    implemented: true,
    // The counterattack only occurs after absorbing an incoming attack. The
    // benchmark target never attacks, so activation alone has no effects.
    effects: [],
    quicknessCastTimeMs: 1000,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Custom: Spends adrenaline and opens the Full Counter trigger window; see `spellbreaker/skills/execution.ts`.
    handlerId: 'warrior.full-counter'
  },
  [ID.DISSONANCE]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1
      },
      {
        type: 'control',
        controlKind: 'stun',
        duration: 1
      }
    ],
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/skills/execution.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.WINDS_OF_DISENCHANTMENT]: {
    interruptCommitMs: 0,
    implemented: true,
    comboFields: [
      {
        ownerId: 'warrior',
        fieldType: 'Lightning',
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 800 + index * 1000, coefficient: 2.25 / 5 })),
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'custom',
        eventType: 'warrior.boon-removal',
        atMs: 800,
        intervalMs: 1000,
        applications: 5,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        event: {
          attemptedBoonRemovals: 1
        }
      }
    ],
    quicknessCastTimeMs: 1000
  },
  [ID.FEATHERFOOT_GRACE]: {
    implemented: true,
    effects: [
      {
        type: 'boon',
        boon: 'resistance',
        duration: 5,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 5,
        stacks: 1
      }
    ],
    quicknessCastTimeMs: 333
  },
  [ID.MAGEHUNTER_STRIKE]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1
      }
    ],
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/skills/execution.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.PATH_TO_VICTORY_ID_72089]: {
    implemented: true,
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
    ],
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/skills/execution.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.HARRIERS_TOSS_ID_73014]: {
    implemented: true,
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
    ],
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/skills/execution.ts`.
    handlerId: 'warrior.resource'
  }
});
