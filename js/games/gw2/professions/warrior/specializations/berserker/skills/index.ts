/** Berserker PvE packets use nearest-40 ms offsets to remove false timing precision. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';
export const BERSERKER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SUNDERING_LEAP]: {
    movementSkill: true,
    // Retain a field crossed during the leap even when it expires before landing.
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: 'Leap',
        fieldSelectionAnchor: 'castStart',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 840, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 2.5
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
        duration: 8
      },
      {
        type: 'boon',
        boon: 'aegis',
        duration: 3,
        stacks: 1
      }
    ]),
    castTimeMs: 960,
    adrenalineGain: 10,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.GUN_FLAME]: {
    effects: [
      {
        type: 'strike',
        coefficient: 2.2,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 10
      },
      {
        type: 'control',
        controlKind: 'daze'
      }
    ],
    castTimeMs: 500,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.SKULL_GRINDER]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'control',
        controlKind: 'daze'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 4,
        duration: 8
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 5,
        duration: 3
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 8
      }
    ],
    castTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.ARC_DIVIDER]: {
    skillWeapon: 'Greatsword',
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 600, coefficient: 3.5 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    castTimeMs: 680,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.SCORCHED_EARTH]: {
    skillWeapon: 'Longbow',
    comboFields: [
      {
        ownerId: 'warrior',
        fieldType: 'Fire',
        duration: 4,
        startAnchor: 'castEnd'
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [320, 2320, 4320].map((atMs) => ({ atMs, coefficient: 0.5 }))
      },
      {
        type: 'condition',
        ticks: [320, 2320, 4320].map((atMs) => ({ atMs, condition: 'Burning', stacks: 1, duration: 3 }))
      }
    ]),
    castTimeMs: 360,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.WILD_BLOW]: {
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        // Wild Blow always critically hits, regardless of precision.
        forceCrit: true
      },
      {
        type: 'control',
        controlKind: 'daze'
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 8,
        stacks: 1
      }
    ],
    castTimeMs: 600,
    adrenalineGain: 5,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.SHATTERING_BLOW]: {
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 320, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.5
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 4,
        duration: 10
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 2,
        stacks: 2
      }
    ]),
    castTimeMs: 520,
    adrenalineGain: 5,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.BERSERK]: {
    castTimeMs: 0,
    effects: [],
    adrenalineCost: 30,
    burstTier: 3,
    adrenalineGain: 10,
    // Custom: Spends adrenaline, enters Berserk, and applies entry traits; see `berserker/execution/index.ts`.
    handlerId: 'warrior.berserk'
  },
  [ID.BLOOD_RECKONING]: {
    effects: [],
    castTimeMs: 280,
    dualWieldCastTimeMs: 240,
    adrenalineGain: 10,
    // Custom: Applies adrenaline gain and resets all primal-burst cooldowns; see `berserker/execution/index.ts`.
    handlerId: 'warrior.blood-reckoning'
  },
  [ID.OUTRAGE]: {
    castTimeMs: 0,
    effects: [],
    adrenalineGain: 10,
    stunbreak: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.HEAD_BUTT]: {
    movementSkill: true,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 760, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 4.5
      },
      {
        type: 'control',
        controlKind: 'stun'
      }
    ]),
    castTimeMs: 800,
    interruptCommitMs: 760,
    adrenalineGain: 30,
    // Head Butt stuns both the foe and the player. The self-stun holds the cast
    // lane for 1s unless broken by a stunbreak (Outrage) or negated by stability.
    selfStunMs: 1000,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.FLAMING_FLURRY]: {
    skillWeapon: 'Sword',
    // Flaming Flurry safely commits by its final 1560ms packet; per-packet
    // interruptions retain only the strike and burning packets already fired.
    interruptCommitMs: 1560,
    interruptMode: 'per-packet',
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [400, 640, 880, 1120, 1320, 1560].map((atMs) => ({ atMs, coefficient: 0.33 }))
      },
      {
        type: 'condition',
        ticks: [400, 640, 880, 1120, 1320, 1560].map((atMs) => ({
          atMs,
          condition: 'Burning',
          stacks: 1,
          duration: 3.5
        }))
      }
    ]),
    castTimeMs: 1600,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.DECAPITATE]: {
    skillWeapon: 'Axe',
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 5,
        stacks: 5
      }
    ],
    castTimeMs: 720,
    dualWieldCastTimeMs: 480,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.RUPTURING_SMASH]: {
    movementSkill: true,
    skillWeapon: 'Hammer',
    cooldown: 5,
    effects: [
      {
        type: 'strike',
        coefficient: 2.75,
        hits: 1,
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
        condition: 'Immobilized',
        stacks: 1,
        duration: 2
      },
      {
        type: 'control',
        controlKind: 'daze'
      }
    ],
    castTimeMs: 920,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.SLICING_MAELSTROM]: {
    cooldown: 5,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1
      }
    ],
    castTimeMs: 500,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.RAMPART_SPLITTER]: {
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
    primalBurst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
    handlerId: 'warrior.resource'
  },
  [ID.WILD_THROW]: {
    interruptMode: 'per-packet',
    skillWeapon: 'Spear',
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 240, coefficient: 0.75 },
          {
            atMs: 440,
            coefficient: 0.75,
            metadata: { evtcSkillId: ID.WILD_THROW_ALTERNATE }
          },
          { atMs: 600, coefficient: 0.75 },
          {
            atMs: 800,
            coefficient: 0.75,
            metadata: { evtcSkillId: ID.WILD_THROW_ALTERNATE }
          },
          { atMs: 960, coefficient: 0.75 },
          {
            atMs: 1160,
            coefficient: 0.75,
            metadata: { evtcSkillId: ID.WILD_THROW_ALTERNATE }
          },
          { atMs: 1280, coefficient: 0.75 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 2,
        duration: 5
      }
    ],
    castTimeMs: 1280,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    // Custom: Applies adrenaline gain/spend, burst traits, and tier-dependent packets; see `core/execution/index.ts`.
    handlerId: 'warrior.resource'
  }
});
