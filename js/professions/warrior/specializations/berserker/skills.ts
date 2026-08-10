/** Explicit PvE skill mechanics owned by the Berserker Warrior module. */
import { WARRIOR_SKILL_IDS as ID } from "../../data/ids.js";
import type { SkillFragment } from "../../../../platform/engine/types.js";

export const BERSERKER_SKILL_MECHANICS: Readonly<
  Record<number, SkillFragment>
> = Object.freeze({
  [ID.SUNDERING_LEAP]: {
    implemented: true,
    finisherType: "Leap",
    finisherValue: 1,
    effects: [
      {
        type: "strike",
        coefficient: 2.5,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Crippled",
        stacks: 1,
        duration: 5,
      },
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 10,
        duration: 8,
      },
      {
        type: "boon",
        boon: "aegis",
        duration: 3,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 500,
    adrenalineGain: 10,
    handlerId: "warrior.resource",
  },
  [ID.GUN_FLAME]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 2.2,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 1,
        duration: 10,
      },
      {
        type: "control",
        metadata: {
          controlKind: "daze",
        },
      },
    ],
    quicknessCastTimeMs: 500,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    handlerId: "warrior.resource",
  },
  [ID.SKULL_GRINDER]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
        hits: 1,
      },
      {
        type: "control",
        metadata: {
          controlKind: "daze",
          duration: 1,
        },
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 4,
        duration: 8,
      },
      {
        type: "condition",
        condition: "Confusion",
        stacks: 5,
        duration: 3,
      },
      {
        type: "condition",
        condition: "Crippled",
        stacks: 1,
        duration: 8,
      },
    ],
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    handlerId: "warrior.resource",
  },
  [ID.ARC_DIVIDER]: {
    implemented: true,
    skillWeapon: "Greatsword",
    effects: [
      {
        type: "strike",
        coefficient: 3.5,
        hits: 1,
        atMs: 882.692307692308,
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
    quicknessCastTimeMs: 680,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    handlerId: "warrior.resource",
  },
  [ID.SCORCHED_EARTH]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
        hits: 3,
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 3,
        duration: 4,
      },
    ],
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    handlerId: "warrior.resource",
  },
  [ID.WILD_BLOW]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 2.5,
        hits: 1,
        // Wild Blow always critically hits, regardless of precision.
        metadata: {
          forceCrit: true,
        },
      },
      {
        type: "control",
        metadata: {
          controlKind: "daze",
          duration: 3,
        },
      },
      {
        type: "boon",
        boon: "fury",
        duration: 8,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 600,
    adrenalineGain: 5,
    handlerId: "warrior.resource",
  },
  [ID.SHATTERING_BLOW]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 4,
        duration: 10,
      },
      {
        type: "boon",
        boon: "stability",
        duration: 2,
        stacks: 2,
      },
    ],
    quicknessCastTimeMs: 333,
    adrenalineGain: 5,
    handlerId: "warrior.resource",
  },
  [ID.BERSERK]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    adrenalineCost: 30,
    burstTier: 3,
    adrenalineGain: 10,
    handlerId: "warrior.berserk",
  },
  [ID.BLOOD_RECKONING]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 280,
    adrenalineGain: 10,
    handlerId: "warrior.blood-reckoning",
  },
  [ID.OUTRAGE]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    adrenalineGain: 10,
    stunbreak: true,
    handlerId: "warrior.resource",
  },
  [ID.HEAD_BUTT]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 4.5,
        hits: 1,
      },
      {
        type: "control",
        metadata: {
          controlKind: "stun",
          duration: 3,
        },
      },
    ],
    quicknessCastTimeMs: 800,
    adrenalineGain: 30,
    // Head Butt stuns both the foe and the player. The self-stun holds the cast
    // lane for 1s unless broken by a stunbreak (Outrage) or negated by stability.
    selfStunMs: 1000,
    handlerId: "warrior.resource",
  },
  [ID.BERSERK_ID_30435]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    adrenalineCost: 30,
    burstTier: 3,
    adrenalineGain: 10,
    handlerId: "warrior.berserk",
  },
  [ID.FLAMING_FLURRY]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1.98,
        hits: 6,
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 6,
        duration: 4,
      },
    ],
    quicknessCastTimeMs: 1333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    handlerId: "warrior.resource",
  },
  [ID.DECAPITATE]: {
    implemented: true,
    skillWeapon: "Axe",
    cooldown: 0,
    effects: [
      {
        type: "strike",
        coefficient: 3,
        hits: 1,
      },
      {
        type: "boon",
        boon: "might",
        duration: 5,
        stacks: 5,
      },
    ],
    quicknessCastTimeMs: 720,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    handlerId: "warrior.resource",
  },
  [ID.RUPTURING_SMASH]: {
    implemented: true,
    skillWeapon: "Hammer",
    cooldown: 5,
    effects: [
      {
        type: "strike",
        coefficient: 2.75,
        hits: 1,
        metadata: {
          finisherType: "blast",
        },
      },
      {
        type: "condition",
        condition: "Immobilized",
        stacks: 1,
        duration: 2,
      },
      {
        type: "control",
        metadata: {
          controlKind: "daze",
          duration: 1,
        },
      },
    ],
    quicknessCastTimeMs: 920,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    handlerId: "warrior.resource",
  },
  [ID.BURNING_SHACKLES]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 2.75,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 1,
        duration: 10,
      },
    ],
    quicknessCastTimeMs: 1167,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    handlerId: "warrior.resource",
  },
  [ID.WILD_WHIRL]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 1,
        duration: 6,
      },
      {
        type: "control",
        metadata: {
          controlKind: "pull",
        },
      },
    ],
    quicknessCastTimeMs: 500,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    handlerId: "warrior.resource",
  },
  [ID.SLICING_MAELSTROM]: {
    implemented: true,
    cooldown: 5,
    effects: [
      {
        type: "strike",
        coefficient: 2.5,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 500,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    handlerId: "warrior.resource",
  },
  [ID.RAMPART_SPLITTER]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
        hits: 1,
      },
      {
        type: "boon",
        boon: "regeneration",
        duration: 5,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    handlerId: "warrior.resource",
  },
  [ID.WILD_THROW]: {
    implemented: true,
    skillWeapon: "Spear",
    effects: [
      {
        type: "strike",
        ticks: [
          { atMs: 350, coefficient: 0.75 },
          {
            atMs: 650,
            coefficient: 0.75,
            metadata: { evtcSkillId: ID.WILD_THROW_ALTERNATE },
          },
          { atMs: 900, coefficient: 0.75 },
          {
            atMs: 1200,
            coefficient: 0.75,
            metadata: { evtcSkillId: ID.WILD_THROW_ALTERNATE },
          },
          { atMs: 1450, coefficient: 0.75 },
          {
            atMs: 1750,
            coefficient: 0.75,
            metadata: { evtcSkillId: ID.WILD_THROW_ALTERNATE },
          },
          { atMs: 1920, coefficient: 0.75 },
        ],
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 2,
        duration: 5,
      },
    ],
    quicknessCastTimeMs: 1280,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    handlerId: "warrior.resource",
  },
});
