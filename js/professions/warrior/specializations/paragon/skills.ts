/** Explicit PvE skill mechanics owned by the Paragon Warrior module. */
import { WARRIOR_SKILL_IDS as ID } from "../../data/ids.js";
import type { SkillFragment } from "../../../../platform/engine/types.js";

export const PARAGON_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> =
  Object.freeze({
    [ID.WE_WILL_NEVER_YIELD]: {
      implemented: true,
      castTimeMs: 1000,
      effects: [],
      quicknessCastTimeMs: 667,
    },
    [ID.WE_SHALL_RETURN]: {
      implemented: true,
      castTimeMs: 1000,
      effects: [],
      quicknessCastTimeMs: 667,
    },
    [ID.NEVER_SURRENDER]: {
      implemented: true,
      castTimeMs: 500,
      effects: [
        {
          type: "boon",
          boon: "resistance",
          duration: 4,
          stacks: 1,
        },
        {
          type: "boon",
          boon: "aegis",
          duration: 3,
          stacks: 1,
        },
        {
          type: "boon",
          boon: "resolution",
          duration: 4,
          stacks: 1,
        },
        {
          type: "boon",
          boon: "regeneration",
          duration: 4,
          stacks: 1,
        },
      ],
      quicknessCastTimeMs: 333,
    },
    [ID.CHANT_OF_RECUPERATION]: {
      implemented: true,
      castTimeMs: 250,
      effects: [],
      quicknessCastTimeMs: 167,
      adrenalineCost: 10,
      burstTier: 1,
      burst: true,
      handlerId: "warrior.chant",
    },
    [ID.BRACE_YOURSELVES]: {
      implemented: true,
      castTimeMs: 250,
      effects: [
        {
          type: "boon",
          boon: "protection",
          duration: 5,
          stacks: 1,
        },
      ],
      quicknessCastTimeMs: 167,
      adrenalineGain: 10,
      handlerId: "warrior.resource",
    },
    [ID.FIND_THEIR_WEAKNESS]: {
      implemented: true,
      castTimeMs: 500,
      effects: [
        {
          type: "strike",
          coefficient: 2,
          hits: 1,
        },
        {
          type: "condition",
          condition: "Vulnerability",
          stacks: 10,
          duration: 10,
        },
        {
          type: "boon",
          boon: "might",
          duration: 10,
          stacks: 5,
        },
      ],
      quicknessCastTimeMs: 333,
    },
    [ID.ON_YOUR_KNEES]: {
      implemented: true,
      castTimeMs: 250,
      effects: [
        {
          type: "strike",
          coefficient: 1.5,
          hits: 1,
        },
        {
          type: "condition",
          condition: "Crippled",
          stacks: 1,
          duration: 6,
        },
        {
          type: "condition",
          condition: "Weakness",
          stacks: 1,
          duration: 6,
        },
      ],
      quicknessCastTimeMs: 167,
    },
    [ID.CHANT_OF_FREEDOM]: {
      implemented: true,
      castTimeMs: 250,
      effects: [],
      quicknessCastTimeMs: 167,
      adrenalineCost: 10,
      burstTier: 1,
      burst: true,
      handlerId: "warrior.chant",
    },
    [ID.CHANT_OF_ACTION]: {
      implemented: true,
      castTimeMs: 250,
      effects: [],
      quicknessCastTimeMs: 167,
      adrenalineCost: 10,
      burstTier: 1,
      burst: true,
      handlerId: "warrior.chant",
    },
  });
