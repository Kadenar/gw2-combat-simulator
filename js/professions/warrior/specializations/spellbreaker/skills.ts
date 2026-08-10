/** Explicit PvE skill mechanics owned by the Spellbreaker Warrior module. */
import { WARRIOR_SKILL_IDS as ID } from "../../data/ids.js";
import type { SkillFragment } from "../../../../platform/engine/types.js";

export const SPELLBREAKER_SKILL_MECHANICS: Readonly<
  Record<number, SkillFragment>
> = Object.freeze({
  [ID.SILENCER]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 0.7,
        hits: 1,
      },
      {
        type: "control",
        metadata: {
          controlKind: "stun",
          duration: 1,
        },
      },
    ],
    adrenalineCost: 10,
    burstTier: 1,
    adrenalineGain: 10,
    burst: true,
    handlerId: "warrior.resource",
  },
  [ID.EARTHSHAKER_ID_40601]: {
    implemented: true,
    skillWeapon: "Hammer",
    cooldown: 8,
    recharge: 8,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 2.75,
        hits: 1,
        atMs: 840,
        timingAnchor: "castStart",
        timingScale: "fixed",
        metadata: {
          finisherType: "blast",
        },
      },
      {
        type: "control",
        atMs: 840,
        timingAnchor: "castStart",
        timingScale: "fixed",
        metadata: {
          controlKind: "stun",
          duration: 1,
        },
      },
    ],
    quicknessCastTimeMs: 1000,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: "warrior.resource",
  },
  [ID.NATURAL_HEALING]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [],
    quicknessCastTimeMs: 667,
  },
  [ID.SKULL_CRACK_ID_41110]: {
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
          controlKind: "stun",
          duration: 1,
        },
      },
    ],
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: "warrior.resource",
  },
  [ID.BOON_CRUSHER]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 0.5,
        hits: 2,
      },
    ],
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: "warrior.resource",
  },
  [ID.FORCEFUL_SHOT_ID_41330]: {
    implemented: true,
    castTimeMs: 1750,
    effects: [
      {
        type: "strike",
        coefficient: 2.25,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 1167,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: "warrior.resource",
  },
  [ID.WOUNDING_STRIKE]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 0.5,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 2,
        duration: 8,
      },
      {
        type: "condition",
        condition: "Torment",
        stacks: 5,
        duration: 8,
      },
    ],
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: "warrior.resource",
  },
  [ID.WHIRLING_STRIKE_ID_41746]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
        hits: 1,
      },
      {
        type: "control",
        metadata: {
          controlKind: "stun",
          duration: 1,
        },
      },
    ],
    quicknessCastTimeMs: 500,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: "warrior.resource",
  },
  [ID.IMMINENT_THREAT]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "boon",
        boon: "resolution",
        duration: 5,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 167,
    adrenalineGain: 3,
    handlerId: "warrior.resource",
  },
  [ID.KILL_SHOT_ID_42041]: {
    implemented: true,
    castTimeMs: 1250,
    effects: [
      {
        type: "strike",
        coefficient: 2.25,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 833,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: "warrior.resource",
  },
  [ID.ARCING_SLICE_ID_42707]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 2,
        hits: 1,
        coefficientModifiers: [
          {
            kind: "target-health-below",
            threshold: 0.5,
            multiplier: 1.5,
          },
        ],
      },
      {
        type: "boon",
        boon: "fury",
        duration: 8,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: "warrior.resource",
  },
  [ID.COMBUSTIVE_SHOT_ID_42803]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 2,
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 2,
        duration: 5,
      },
    ],
    quicknessCastTimeMs: 500,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: "warrior.resource",
  },
  [ID.BREAK_ENCHANTMENTS]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
        hits: 1,
      },
      {
        type: "custom",
        eventType: "warrior.boon-removal",
        event: {
          attemptedBoonRemovals: 4,
        },
      },
    ],
    quicknessCastTimeMs: 167,
  },
  [ID.FLEETING_STABILITY]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 0.5,
        hits: 1,
      },
      {
        type: "control",
        metadata: {
          controlKind: "stun",
          duration: 2,
        },
      },
    ],
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: "warrior.resource",
  },
  [ID.EVISCERATE_ID_43566]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "boon",
        boon: "might",
        duration: 5,
        stacks: 5,
      },
      {
        type: "strike",
        coefficient: 2,
        hits: 1,
      },
    ],
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: "warrior.resource",
  },
  [ID.SIGHT_BEYOND_SIGHT]: {
    implemented: true,
    castTimeMs: 500,
    effects: [],
    quicknessCastTimeMs: 333,
  },
  [ID.FULL_COUNTER]: {
    implemented: true,
    castTimeMs: 1500,
    effects: [
      {
        type: "strike",
        coefficient: 2,
        hits: 1,
      },
      {
        type: "boon",
        boon: "stability",
        duration: 2,
        stacks: 1,
      },
      {
        type: "control",
        metadata: {
          controlKind: "daze",
          duration: 1,
        },
      },
    ],
    quicknessCastTimeMs: 1000,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: "warrior.full-counter",
  },
  [ID.DISSONANCE]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 0.5,
        hits: 1,
      },
      {
        type: "control",
        metadata: {
          controlKind: "stun",
          duration: 1,
        },
      },
    ],
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: "warrior.resource",
  },
  [ID.WINDS_OF_DISENCHANTMENT]: {
    implemented: true,
    comboField: "Lightning",
    duration: 5,
    castTimeMs: 1500,
    effects: [
      {
        type: "strike",
        coefficient: 2.25,
        hits: 5,
        atMs: 800,
        intervalMs: 1000,
        timingAnchor: "castEnd",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
        metadata: {
          extendsResolutionHorizon: true,
        },
      },
      {
        type: "custom",
        eventType: "warrior.boon-removal",
        atMs: 800,
        intervalMs: 1000,
        applications: 5,
        timingAnchor: "castEnd",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
        event: {
          attemptedBoonRemovals: 1,
        },
      },
    ],
    quicknessCastTimeMs: 1000,
  },
  [ID.FEATHERFOOT_GRACE]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "boon",
        boon: "resistance",
        duration: 5,
        stacks: 1,
      },
      {
        type: "boon",
        boon: "protection",
        duration: 5,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.MAGEHUNTER_STRIKE]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
      },
    ],
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: "warrior.resource",
  },
  [ID.BREACHING_STRIKE_ID_69297]: {
    implemented: true,
    skillWeapon: "Dagger",
    finisherType: "Leap",
    finisherValue: 1,
    cooldown: 8,
    recharge: 8,
    castTimeMs: 840,
    effects: [
      {
        type: "strike",
        coefficient: 2.5,
        hits: 1,
        atMs: 760,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "custom",
        eventType: "warrior.boon-removal",
        atMs: 760,
        timingAnchor: "castStart",
        timingScale: "fixed",
        event: {
          attemptedBoonRemovals: 2,
        },
      },
    ],
    quicknessCastTimeMs: 840,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: "warrior.resource",
  },
  [ID.PATH_TO_VICTORY_ID_72089]: {
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
    handlerId: "warrior.resource",
  },
  [ID.HARRIERS_TOSS_ID_73014]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 5,
        duration: 6,
      },
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
    handlerId: "warrior.resource",
  },
  [ID.BLOODTHIRSTER_ID_80252]: {
    implemented: true,
    skillWeapon: "Sword",
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 2,
        hits: 1,
        atMs: 600,
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 3,
        duration: 6,
        atMs: 600,
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
    quicknessCastTimeMs: 500,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: "warrior.resource",
  },
});
