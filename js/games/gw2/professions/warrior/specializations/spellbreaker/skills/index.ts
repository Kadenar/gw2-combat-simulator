/** Explicit PvE skill mechanics owned by the Spellbreaker Warrior module. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { impactEffects } from '#gw2/platform/engine/effects/factories.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';
export const SPELLBREAKER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.EARTHSHAKER_ID_40601]: {
    skillWeapon: 'Hammer',
    cooldown: 8,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 840, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 2.75,
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
        controlKind: 'stun'
      }
    ]),
    castTimeMs: 1000,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.NATURAL_HEALING]: {
    effects: [],
    castTimeMs: 667
  },
  [ID.SKULL_CRACK_ID_41110]: {
    // Spellbreaker's level-one variant shares the mace burst's cast and impact timing.
    skillWeapon: 'Mace',
    cooldown: 8,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'control',
        controlKind: 'daze'
      }
    ]),
    castTimeMs: 560,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.ARCING_SLICE_ID_42707]: {
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
    castTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.COMBUSTIVE_SHOT_ID_42803]: {
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
    castTimeMs: 500,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.BREAK_ENCHANTMENTS]: {
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
    castTimeMs: 167
  },
  [ID.EVISCERATE_ID_43566]: {
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
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.FULL_COUNTER]: {
    // The counterattack only occurs after absorbing an incoming attack. The
    // benchmark target never attacks, so activation alone has no effects.
    effects: [],
    castTimeMs: 1000,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Custom: Spends adrenaline and opens the Full Counter trigger window; see `spellbreaker/execution/index.ts`.
    handlerId: 'warrior.full-counter'
  },
  [ID.WINDS_OF_DISENCHANTMENT]: {
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
        timingScale: 'fixed'
      },
      {
        type: 'custom',
        eventType: 'warrior.boon-removal',
        atMs: 800,
        intervalMs: 1000,
        applications: 5,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        event: {
          attemptedBoonRemovals: 1
        }
      }
    ],
    castTimeMs: 1000
  },
  [ID.PATH_TO_VICTORY_ID_72089]: {
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
    castTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.HARRIERS_TOSS_ID_73014]: {
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
    castTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
    handlerId: 'warrior.resource'
  }
});
