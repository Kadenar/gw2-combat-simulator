/**
 * Mechanist Engineer skill mechanics.
 *
 * Weapon skills remain Core-owned because Weaponmaster Training makes the
 * physical weapon families profession-wide.
 */
import { ENGINEER_SKILL_IDS as ID } from '../../data/ids.js';
import type { SkillFragment } from '../../../../../platform/engine/types.js';
import { MECHANIST_COMMAND_DURATIONS } from './mechanics.js';

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
    implemented: true,
    castTimeMs: 750,
    cooldown: 30,
    effects: []
  },
  [ID.CRASH_DOWN]: {
    implemented: true,
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
        metadata: {
          controlKind: 'launch',
          duration: 200
        }
      }
    ],
    mechanicSlot: 4
  },
  [ID.RECALL_MECH]: {
    implemented: true,
    handlerId: 'engineer.mech-recall',
    castTimeMs: 750,
    cooldown: 10,
    paletteTileId: MECH_TOGGLE_PALETTE_TILE,
    paletteTileOrder: 2,
    effects: [],
    mechanicSlot: 4
  },
  [ID.OVERCLOCK_SIGNET]: {
    implemented: true,
    handlerId: 'engineer.overclock-signet',
    castTimeMs: 0,
    cooldown: 90,
    effects: []
  },
  [ID.SHIFT_SIGNET]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 25,
    effects: []
  },
  [ID.SUPERCONDUCTING_SIGNET]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 30,
    effects: [
      {
        type: 'strike',
        coefficient: 14.399999999999999,
        hits: 6,
        atMs: 86.666666666667,
        intervalMs: 86.666666666667,
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
    implemented: true,
    interruptCommitMs: 0,
    quicknessCastTimeMs: MECHANIST_COMMAND_DURATIONS[ID.JADE_MORTAR] * 1000,
    // Issuing the command starts recharge even though the mech remains busy
    // on its independent lane for the measured animation.
    rechargeAnchor: 'castStart',
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 2.2,
        hits: 1,
        atMs: 601,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Jade Mortar',
        actorType: 'summon',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 3,
        duration: 6,
        atMs: 601,
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
        metadata: {
          controlKind: 'daze',
          duration: 1
        }
      }
    ],
    mechanicSlot: 3
  }),
  [ID.BARRIER_BURST]: mechCommand({
    implemented: true,
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
    implemented: true,
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
    implemented: true,
    castTimeMs: 500,
    cooldown: 5,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Rocket Punch (Mech)',
        actorType: 'summon',
        metadata: {
          damageKind: 'explosion'
        }
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
        metadata: {
          controlKind: 'defiance',
          duration: 100
        }
      }
    ]
  },
  [ID.SPARK_REVOLVER]: mechCommand({
    implemented: true,
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
    implemented: true,
    castTimeMs: 1500,
    cooldown: 30,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 3,
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
        metadata: {
          controlKind: 'knockdown',
          duration: 232
        }
      }
    ],
    mechanicSlot: 3
  }),
  [ID.FORCE_SIGNET]: {
    implemented: true,
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
        metadata: {
          controlKind: 'knockback',
          duration: 240
        }
      }
    ]
  },
  [ID.BARRIER_SIGNET]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 30,
    effects: []
  },
  [ID.HEAVY_SMASH_MECH]: {
    implemented: true,
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
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: []
  },
  [ID.TWIN_STRIKE_MECH]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 2,
        atMs: 180,
        intervalMs: 180,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Twin Strike (Mech)',
        actorType: 'summon'
      }
    ]
  },
  [ID.CRISIS_ZONE]: mechCommand({
    implemented: true,
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
    implemented: true,
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
    implemented: true,
    handlerId: 'engineer.mech-recall',
    castTimeMs: 750,
    cooldown: 10,
    effects: [],
    mechanicSlot: 4
  },
  [ID.ROLLING_SMASH]: mechCommand({
    implemented: true,
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
    implemented: true,
    interruptCommitMs: 0,
    quicknessCastTimeMs: MECHANIST_COMMAND_DURATIONS[ID.CORE_REACTOR_SHOT] * 1000,
    rechargeAnchor: 'castStart',
    cooldown: 25,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        atMs: 684,
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
        metadata: {
          controlKind: 'launch',
          duration: 232
        }
      }
    ],
    mechanicSlot: 2
  }),
  [ID.JADE_ENERGY_SHOT_ID_63348]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: []
  },
  [ID.EXPLOSIVE_KNUCKLE]: mechCommand({
    implemented: true,
    castTimeMs: 500,
    cooldown: 15,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1,
        name: 'Explosive Knuckle',
        actorType: 'summon',
        metadata: {
          damageKind: 'explosion'
        }
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
    implemented: true,
    castTimeMs: 0,
    cooldown: 30,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 5,
        atMs: 0,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Discharge Array',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 2,
        applications: 5,
        atMs: 0,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 2,
        duration: 3,
        applications: 5,
        atMs: 0,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 3,
        applications: 5,
        atMs: 0,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'summon'
      }
    ],
    mechanicSlot: 2
  }),
  [ID.JADE_BUSTER_CANNON]: {
    implemented: true,
    simulatorExcluded: true,
    castTimeMs: 3250,
    cooldown: 1,
    effects: [
      {
        type: 'strike',
        coefficient: 4.75,
        hits: 5,
        atMs: 440,
        intervalMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Jade Buster Cannon',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 6,
        applications: 5,
        atMs: 440,
        intervalMs: 440,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        actorType: 'summon'
      }
    ],
    toolbeltParentName: 'Overclock Signet'
  },
  [ID.MECH_SUPPORT_DEPTH_CHARGES]: {
    implemented: true,
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
