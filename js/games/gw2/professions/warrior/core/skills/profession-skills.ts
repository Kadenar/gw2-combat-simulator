/** Canonical Core warrior skill fragments grouped by their GW2 owner. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const WARRIOR_PROFESSION_SKILLS_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.EVISCERATE]: {
    // The API omits the burst's weapon; axe critical traits still apply to this strike.
    skillWeapon: 'Axe',
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Leap',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    cooldown: 8,
    castTimeMs: 0,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
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
  [ID.ARCING_SLICE]: {
    cooldown: 8,
    castTimeMs: 480,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
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
  [ID.EARTHSHAKER]: {
    skillWeapon: 'Hammer',
    cooldown: 8,
    castTimeMs: 1000,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
    handlerId: 'warrior.resource',
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
        controlKind: 'stun'
      }
    ]
  },
  [ID.KILL_SHOT]: {
    skillWeapon: 'Rifle',
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Projectile',
        chance: 1,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    // Kill Shot lands before its measured animation ends; tier scaling preserves this packet.
    cooldown: 8,
    castTimeMs: 1160,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        coefficient: 2.25,
        hits: 1,
        name: 'Kill Shot — Level 1 Damage',
        atMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.SKULL_CRACK]: {
    // The burst's daze and damage share the observed impact before the animation ends.
    skillWeapon: 'Mace',
    cooldown: 8,
    castTimeMs: 560,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        controlKind: 'daze',
        atMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  },
  [ID.COMBUSTIVE_SHOT]: {
    comboFields: [
      {
        ownerId: 'warrior',
        fieldType: 'Fire',
        duration: 3,
        startAnchor: 'castEnd'
      }
    ],
    burstFieldDurations: [3, 6, 9],
    castTimeMs: 520,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Custom: Spends adrenaline and builds tier-scaled field pulses; see `core/execution/index.ts`.
    handlerId: 'warrior.combustive-shot',
    effects: []
  },
  [ID.BREACHING_STRIKE]: {
    // Keep commitment, damage, and boon removal together on the nearest 40 ms tick.
    interruptCommitMs: 760,
    skillWeapon: 'Dagger',
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Leap',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    cooldown: 8,
    castTimeMs: 840,

    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 760, coefficient: 2.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'custom',
        eventType: 'warrior.boon-removal',
        atMs: 760,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        event: {
          attemptedBoonRemovals: 2
        }
      }
    ]
  },
  [ID.PATH_TO_VICTORY]: {
    castTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Numeric variants share the canonical burst's resource and trait contract.
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
  [ID.PATH_TO_VICTORY_ID_71932]: {
    castTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
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
    castTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Numeric variants share the canonical burst's resource and trait contract.
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
  [ID.HARRIERS_TOSS_ID_73006]: {
    castTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Numeric variants share the canonical burst's resource and trait contract.
    handlerId: 'warrior.resource',
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
  [ID.HARRIERS_TOSS]: {
    castTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
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
    castTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Numeric variants share the canonical burst's resource and trait contract.
    handlerId: 'warrior.resource',
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
    skillWeapon: 'Sword',
    castTimeMs: 500,
    dualWieldCastTimeMs: 400,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
    handlerId: 'warrior.resource',
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 2 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 400, condition: 'Bleeding', stacks: 3, duration: 6 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  }
});
