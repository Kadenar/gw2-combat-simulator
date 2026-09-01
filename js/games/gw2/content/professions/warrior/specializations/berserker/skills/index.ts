/** Explicit PvE skill mechanics owned by the Berserker Warrior module. */
import { WARRIOR_SKILL_IDS as ID } from '#gw2/content/professions/warrior/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';
export const BERSERKER_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.SUNDERING_LEAP]: {
    implemented: true,
    movementSkill: true,
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
        ticks: [{ atMs: 840, coefficient: 2.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 840, condition: 'Crippled', stacks: 1, duration: 5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 840, condition: 'Vulnerability', stacks: 10, duration: 8 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'aegis',
        duration: 3,
        stacks: 1,
        atMs: 840,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    quicknessCastTimeMs: 960,
    adrenalineGain: 10,
    handlerId: 'warrior.resource'
  },
  [ID.GUN_FLAME]: {
    implemented: true,
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
    quicknessCastTimeMs: 500,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    handlerId: 'warrior.resource'
  },
  [ID.SKULL_GRINDER]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'control',
        controlKind: 'daze',
        duration: 1
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
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    handlerId: 'warrior.resource'
  },
  [ID.ARC_DIVIDER]: {
    implemented: true,
    skillWeapon: 'Greatsword',
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 588.461538461539, coefficient: 3.5 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ],
    quicknessCastTimeMs: 680,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    handlerId: 'warrior.resource'
  },
  [ID.SCORCHED_EARTH]: {
    interruptCommitMs: 0,
    implemented: true,
    skillWeapon: 'Longbow',
    comboFields: [
      {
        ownerId: 'warrior',
        fieldType: 'Fire',
        duration: 4,
        startAnchor: 'castEnd'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 320, coefficient: 0.5 },
          { atMs: 2320, coefficient: 0.5 },
          { atMs: 4320, coefficient: 0.5 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 320,
            condition: 'Burning',
            stacks: 1,
            duration: 3
          },
          {
            atMs: 2320,
            condition: 'Burning',
            stacks: 1,
            duration: 3
          },
          {
            atMs: 4320,
            condition: 'Burning',
            stacks: 1,
            duration: 3
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      }
    ],
    quicknessCastTimeMs: 360,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    handlerId: 'warrior.resource'
  },
  [ID.WILD_BLOW]: {
    implemented: true,
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
        controlKind: 'daze',
        duration: 3
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 8,
        stacks: 1
      }
    ],
    quicknessCastTimeMs: 600,
    adrenalineGain: 5,
    handlerId: 'warrior.resource'
  },
  [ID.SHATTERING_BLOW]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 1.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 320, condition: 'Bleeding', stacks: 4, duration: 10 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 2,
        stacks: 2,
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    quicknessCastTimeMs: 520,
    adrenalineGain: 5,
    handlerId: 'warrior.resource'
  },
  [ID.BERSERK]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    adrenalineCost: 30,
    burstTier: 3,
    adrenalineGain: 10,
    handlerId: 'warrior.berserk'
  },
  [ID.BLOOD_RECKONING]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 280,
    dualWieldCastTimeMs: 240,
    adrenalineGain: 10,
    handlerId: 'warrior.blood-reckoning'
  },
  [ID.OUTRAGE]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    adrenalineGain: 10,
    stunbreak: true,
    handlerId: 'warrior.resource'
  },
  [ID.HEAD_BUTT]: {
    implemented: true,
    movementSkill: true,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 760, coefficient: 4.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'control',
        atMs: 760,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        controlKind: 'stun',
        duration: 3
      }
    ],
    quicknessCastTimeMs: 800,
    adrenalineGain: 30,
    // Head Butt stuns both the foe and the player. The self-stun holds the cast
    // lane for 1s unless broken by a stunbreak (Outrage) or negated by stability.
    selfStunMs: 1000,
    handlerId: 'warrior.resource'
  },
  [ID.FLAMING_FLURRY]: {
    implemented: true,
    skillWeapon: 'Sword',
    // Flaming Flurry safely commits by its final 1560ms packet; per-packet
    // interruptions retain only the strike and burning packets already fired.
    interruptCommitMs: 1560,
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 400, coefficient: 0.33 },
          { atMs: 640, coefficient: 0.33 },
          { atMs: 880, coefficient: 0.33 },
          { atMs: 1120, coefficient: 0.33 },
          { atMs: 1320, coefficient: 0.33 },
          { atMs: 1560, coefficient: 0.33 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'condition',
        ticks: [
          {
            atMs: 400,
            condition: 'Burning',
            stacks: 1,
            duration: 3.5
          },
          {
            atMs: 640,
            condition: 'Burning',
            stacks: 1,
            duration: 3.5
          },
          {
            atMs: 880,
            condition: 'Burning',
            stacks: 1,
            duration: 3.5
          },
          {
            atMs: 1120,
            condition: 'Burning',
            stacks: 1,
            duration: 3.5
          },
          {
            atMs: 1320,
            condition: 'Burning',
            stacks: 1,
            duration: 3.5
          },
          {
            atMs: 1560,
            condition: 'Burning',
            stacks: 1,
            duration: 3.5
          }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ],
    quicknessCastTimeMs: 1600,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    handlerId: 'warrior.resource'
  },
  [ID.DECAPITATE]: {
    implemented: true,
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
    quicknessCastTimeMs: 720,
    dualWieldCastTimeMs: 480,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    handlerId: 'warrior.resource'
  },
  [ID.RUPTURING_SMASH]: {
    implemented: true,
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
        controlKind: 'daze',
        duration: 1
      }
    ],
    quicknessCastTimeMs: 920,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    handlerId: 'warrior.resource'
  },
  [ID.BURNING_SHACKLES]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 2.75,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 10
      }
    ],
    quicknessCastTimeMs: 1167,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    handlerId: 'warrior.resource'
  },
  [ID.WILD_WHIRL]: {
    implemented: true,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 6
      },
      {
        type: 'control',
        controlKind: 'pull'
      }
    ],
    quicknessCastTimeMs: 500,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    handlerId: 'warrior.resource'
  },
  [ID.SLICING_MAELSTROM]: {
    implemented: true,
    cooldown: 5,
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1
      }
    ],
    quicknessCastTimeMs: 500,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    handlerId: 'warrior.resource'
  },
  [ID.RAMPART_SPLITTER]: {
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
    primalBurst: true,
    handlerId: 'warrior.resource'
  },
  [ID.WILD_THROW]: {
    implemented: true,
    interruptMode: 'per-packet',
    skillWeapon: 'Spear',
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 233.333333333333, coefficient: 0.75 },
          {
            atMs: 433.333333333333,
            coefficient: 0.75,
            metadata: { evtcSkillId: ID.WILD_THROW_ALTERNATE }
          },
          { atMs: 600, coefficient: 0.75 },
          {
            atMs: 800,
            coefficient: 0.75,
            metadata: { evtcSkillId: ID.WILD_THROW_ALTERNATE }
          },
          { atMs: 966.666666666667, coefficient: 0.75 },
          {
            atMs: 1166.666666666667,
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
    quicknessCastTimeMs: 1280,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    handlerId: 'warrior.resource'
  }
});
