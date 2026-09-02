/**
 * Mechanist Engineer skill mechanics.
 *
 * Weapon skills remain Core-owned because Weaponmaster Training makes the
 * physical weapon families profession-wide.
 */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/content/professions/engineer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';
import { MECHANIST_COMMAND_DURATIONS } from '#gw2/content/professions/engineer/specializations/mechanist/mechanics/constants.js';

// Crash Down and Recall Mech occupy the same profession-mechanic tile.
const MECH_TOGGLE_PALETTE_TILE = 'engineer-mechanist-mech-toggle';

// F1-F3 commands execute on the mech's own serial cast lane so their animations
// can overlap the engineer without allowing non-instant mech commands to overlap.
function mechCommand(fragment: SkillFragment): SkillFragment {
  const instant = Number(fragment.castTimeMs || 0) === 0 && fragment.quicknessCastTimeMs == null;
  return {
    ...fragment,
    independentCast: true,
    ...(instant ? { independentCastCanOverlap: true } : {})
  };
}

export const MECHANIST_SKILL_MECHANICS: Readonly<Record<string, SkillFragment>> = Object.freeze({
  [ID.RECTIFIER_SIGNET]: {
    castTimeMs: 750,
    cooldown: 30,
    effects: []
  },
  [ID.CRASH_DOWN]: {
    // Custom: Summons the mech and starts its autonomous attack loop; see `mechanist/mechanics/mech.ts`.
    handlerId: 'engineer.mech-summon',
    castTimeMs: 750,
    cooldown: 50,
    paletteTileId: MECH_TOGGLE_PALETTE_TILE,
    paletteTileOrder: 1,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        name: 'Crash Down',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'launch',
        duration: 200
      }
    ],
    mechanicSlot: 4
  },
  [ID.RECALL_MECH]: {
    // Custom: Stops the active mech attack loop and recalls it; see `mechanist/mechanics/mech.ts`.
    handlerId: 'engineer.mech-recall',
    castTimeMs: 750,
    cooldown: 10,
    paletteTileId: MECH_TOGGLE_PALETTE_TILE,
    paletteTileOrder: 2,
    effects: [],
    mechanicSlot: 4
  },
  [ID.OVERCLOCK_SIGNET]: {
    // Custom: Resets mech command cooldowns and schedules Overclock behavior; see `mechanist/mechanics/mech.ts`.
    handlerId: 'engineer.overclock-signet',
    castTimeMs: 0,
    cooldown: 90,
    effects: []
  },
  [ID.SHIFT_SIGNET]: {
    castTimeMs: 0,
    cooldown: 25,
    effects: []
  },
  [ID.SUPERCONDUCTING_SIGNET]: {
    castTimeMs: 750,
    cooldown: 30,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 6 }, (_, index) => ({
          atMs: 86.666666666667 + index * 86.666666666667,
          coefficient: 14.399999999999999 / 6
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Superconducting Signet',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 6,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 6,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 6,
        duration: 3,
        actorType: 'player'
      }
    ]
  },
  [ID.JADE_MORTAR]: mechCommand({
    interruptCommitMs: 0,
    quicknessCastTimeMs: MECHANIST_COMMAND_DURATIONS[ID.JADE_MORTAR] * 1000,
    // Issuing the command starts recharge even though the mech remains busy
    // on its independent lane for the measured animation.
    rechargeAnchor: 'castStart',
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 601, coefficient: 2.2 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Jade Mortar',
        actorType: 'summon',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        ticks: [{ atMs: 601, condition: 'Burning', stacks: 3, duration: 6 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'summon',
        persistsAfterInterrupt: true
      },
      {
        type: 'control',
        atMs: 601,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        actorType: 'summon',
        controlKind: 'daze',
        duration: 1
      }
    ],
    mechanicSlot: 3
  }),
  [ID.BARRIER_BURST]: mechCommand({
    castTimeMs: 3750,
    cooldown: 30,
    effects: [
      {
        type: 'boon',
        boon: 'might',
        duration: 20,
        stacks: 2
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 3,
        stacks: 1
      }
    ],
    mechanicSlot: 3
  }),
  [ID.AERIAL_SUPPORT]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Aerial Support',
        actorType: 'player'
      }
    ]
  },
  [ID.ROCKET_PUNCH_MECH]: {
    castTimeMs: 500,
    cooldown: 5,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Rocket Punch (Mech)',
        actorType: 'summon',
        damageKind: 'explosion'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 5,
        actorType: 'summon'
      },
      {
        type: 'control',
        actorType: 'summon',
        controlKind: 'defiance',
        duration: 100
      }
    ]
  },
  [ID.SPARK_REVOLVER]: mechCommand({
    interruptCommitMs: 0,
    quicknessCastTimeMs: MECHANIST_COMMAND_DURATIONS[ID.SPARK_REVOLVER] * 1000,
    rechargeAnchor: 'castStart',
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 717, coefficient: 0.176 },
          { atMs: 717, coefficient: 0.176 },
          { atMs: 834, coefficient: 0.176 },
          { atMs: 834, coefficient: 0.176 },
          { atMs: 1001, coefficient: 0.176 },
          { atMs: 1001, coefficient: 0.176 },
          { atMs: 1151, coefficient: 0.176 },
          { atMs: 1151, coefficient: 0.176 },
          { atMs: 1318, coefficient: 0.176 },
          { atMs: 1318, coefficient: 0.176 },
          { atMs: 1484, coefficient: 0.176 },
          { atMs: 1484, coefficient: 0.176 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Spark Revolver',
        actorType: 'summon',
        persistsAfterInterrupt: true
      }
    ],
    mechanicSlot: 1
  }),
  [ID.SKY_CIRCUS]: mechCommand({
    castTimeMs: 1500,
    cooldown: 30,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 3,
        atMs: 0,
        name: 'Missile Damage',
        actorType: 'summon'
      },
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        name: 'Landing Damage',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 5,
        actorType: 'summon'
      },
      {
        type: 'control',
        actorType: 'summon',
        controlKind: 'knockdown',
        duration: 232
      }
    ],
    mechanicSlot: 3
  }),
  [ID.FORCE_SIGNET]: {
    castTimeMs: 750,
    cooldown: 30,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Force Signet',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'knockback',
        duration: 240
      }
    ]
  },
  [ID.BARRIER_SIGNET]: {
    castTimeMs: 500,
    cooldown: 30,
    effects: []
  },
  [ID.HEAVY_SMASH_MECH]: {
    castTimeMs: 500,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.45,
        hits: 1,
        name: 'Heavy Smash (Mech)',
        actorType: 'summon'
      }
    ]
  },
  [ID.JADE_ENERGY_SHOT]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: []
  },
  [ID.TWIN_STRIKE_MECH]: {
    castTimeMs: 500,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 2 }, (_, index) => ({ atMs: 180 + index * 180, coefficient: 0.8 / 2 })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Twin Strike (Mech)',
        actorType: 'summon'
      }
    ]
  },
  [ID.CRISIS_ZONE]: mechCommand({
    castTimeMs: 0,
    cooldown: 30,
    effects: [
      {
        type: 'boon',
        boon: 'aegis',
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'alacrity',
        duration: 6,
        stacks: 1
      }
    ],
    mechanicSlot: 2
  }),
  [ID.HARD_STRIKE]: {
    castTimeMs: 250,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.45,
        hits: 1,
        name: 'Hard Strike',
        actorType: 'player'
      }
    ]
  },
  [ID.RECALL_MECH_ID_63300]: {
    // Custom: Stops the active mech attack loop and recalls it; see `mechanist/mechanics/mech.ts`.
    handlerId: 'engineer.mech-recall',
    castTimeMs: 750,
    cooldown: 10,
    effects: [],
    mechanicSlot: 4
  },
  [ID.ROLLING_SMASH]: mechCommand({
    castTimeMs: 750,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 1,
        name: 'Rolling Smash',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 4,
        duration: 8,
        actorType: 'summon'
      }
    ],
    mechanicSlot: 1
  }),
  [ID.CORE_REACTOR_SHOT]: mechCommand({
    interruptCommitMs: 0,
    quicknessCastTimeMs: MECHANIST_COMMAND_DURATIONS[ID.CORE_REACTOR_SHOT] * 1000,
    rechargeAnchor: 'castStart',
    cooldown: 25,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 684, coefficient: 2.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Core Reactor Shot',
        actorType: 'summon',
        persistsAfterInterrupt: true
      },
      {
        type: 'control',
        atMs: 684,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        actorType: 'summon',
        controlKind: 'launch',
        duration: 232
      }
    ],
    mechanicSlot: 2
  }),
  [ID.JADE_ENERGY_SHOT_ID_63348]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: []
  },
  [ID.EXPLOSIVE_KNUCKLE]: mechCommand({
    castTimeMs: 500,
    cooldown: 15,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1,
        name: 'Explosive Knuckle',
        actorType: 'summon',
        damageKind: 'explosion'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 5,
        actorType: 'summon'
      }
    ],
    mechanicSlot: 1
  }),
  [ID.DISCHARGE_ARRAY]: mechCommand({
    castTimeMs: 0,
    cooldown: 30,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 0 + index * 1000, coefficient: 1.5 / 5 })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Discharge Array',
        actorType: 'summon'
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 5 }, (_, index) => ({
          atMs: 0 + index * 1000,
          condition: 'Slow',
          stacks: 1,
          duration: 2
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'summon'
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 5 }, (_, index) => ({
          atMs: 0 + index * 1000,
          condition: 'Confusion',
          stacks: 2,
          duration: 3
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'summon'
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 5 }, (_, index) => ({
          atMs: 0 + index * 1000,
          condition: 'Burning',
          stacks: 1,
          duration: 3
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'summon'
      }
    ],
    mechanicSlot: 2
  }),
  [ID.JADE_BUSTER_CANNON]: {
    simulatorExcluded: true,
    castTimeMs: 3250,
    cooldown: 1,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 440 + index * 440, coefficient: 4.75 / 5 })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Jade Buster Cannon',
        actorType: 'summon'
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 5 }, (_, index) => ({
          atMs: 440 + index * 440,
          condition: 'Burning',
          stacks: 1,
          duration: 6
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        actorType: 'summon'
      }
    ],
    toolbeltParentName: 'Overclock Signet'
  },
  [ID.MECH_SUPPORT_DEPTH_CHARGES]: {
    castTimeMs: 500,
    cooldown: 25,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Mech Support: Depth Charges',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 8,
        actorType: 'summon'
      }
    ],
    mechanicSlot: 4
  }
});
