/** Explicit PvE skill mechanics owned by the Berserker Warrior module. */
import { WARRIOR_SKILL_IDS as ID } from "../../data/ids.js";
import type { SkillFragment } from "../../../../platform/engine/types.js";

export const BERSERKER_SKILL_MECHANICS: Readonly<
  Record<number, SkillFragment>
> = Object.freeze({
  [ID.SUNDERING_LEAP]: {
    implemented: true,
    castTimeMs: 750,
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
    castTimeMs: 750,
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
    castTimeMs: 500,
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
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 3.5,
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
  [ID.SCORCHED_EARTH]: {
    implemented: true,
    castTimeMs: 500,
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
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 2.5,
        hits: 1,
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
    quicknessCastTimeMs: 500,
    adrenalineGain: 10,
    handlerId: "warrior.resource",
  },
  [ID.SHATTERING_BLOW]: {
    implemented: true,
    castTimeMs: 500,
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
    adrenalineGain: 10,
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
    castTimeMs: 250,
    effects: [],
    quicknessCastTimeMs: 167,
    adrenalineGain: 10,
    handlerId: "warrior.resource",
  },
  [ID.OUTRAGE]: {
    implemented: true,
    castTimeMs: 500,
    effects: [],
    quicknessCastTimeMs: 333,
    adrenalineGain: 10,
    handlerId: "warrior.resource",
  },
  [ID.HEAD_BUTT]: {
    implemented: true,
    castTimeMs: 750,
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
    quicknessCastTimeMs: 500,
    adrenalineGain: 30,
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
    castTimeMs: 2000,
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
    castTimeMs: 750,
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
    quicknessCastTimeMs: 500,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    handlerId: "warrior.resource",
  },
  [ID.RUPTURING_SMASH]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 2.75,
        hits: 1,
      },
      {
        type: "control",
        metadata: {
          controlKind: "daze",
          duration: 1,
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
  [ID.BURNING_SHACKLES]: {
    implemented: true,
    castTimeMs: 1750,
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
    castTimeMs: 750,
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
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 2.5,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    handlerId: "warrior.resource",
  },
  [ID.RAMPART_SPLITTER]: {
    implemented: true,
    castTimeMs: 500,
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
    castTimeMs: 1750,
    effects: [
      {
        type: "strike",
        coefficient: 5.25,
        hits: 7,
      },
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 2,
        duration: 5,
      },
    ],
    quicknessCastTimeMs: 1167,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    primalBurst: true,
    handlerId: "warrior.resource",
  },
});
