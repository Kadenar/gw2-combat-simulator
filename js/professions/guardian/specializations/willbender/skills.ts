import { GUARDIAN_SKILL_IDS as ID } from "../../data/ids.js";
import type { SkillFragment } from "../../../../platform/engine/types.js";

export const WILLBENDER_SKILL_MECHANICS: Readonly<
  Record<number, SkillFragment>
> = Object.freeze({
  [ID.ROILING_LIGHT]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "strike",
        coefficient: 0.33,
        hits: 1,
      },
      {
        type: "control",
        metadata: {
          controlKind: "control",
        },
      },
      {
        type: "blind",
      },
    ],
  },
  [ID.WILLBENDER_FLAMES]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 0.22,
        hits: 1,
      },
    ],
  },
  [ID.CRASHING_COURAGE]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: "guardian.virtue",
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
        name: "Crashing Courage — Initial Damage",
      },
    ],
  },
  [ID.HEEL_CRACK]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "strike",
        coefficient: 0.75,
        hits: 1,
      },
      {
        type: "control",
        metadata: {
          controlKind: "control",
        },
      },
    ],
  },
  [ID.HEAVENS_PALM]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [
      {
        type: "strike",
        coefficient: 3,
        hits: 1,
      },
      {
        type: "control",
        metadata: {
          controlKind: "control",
        },
      },
    ],
  },
  [ID.WHIRLING_LIGHT]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "strike",
        coefficient: 4,
        hits: 4,
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 1,
        duration: 3,
      },
    ],
  },
  [ID.FLOWING_RESOLVE]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: "guardian.virtue",
    effects: [],
  },
  [ID.FLASH_COMBO]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "strike",
        coefficient: 4.5,
        hits: 5,
      },
    ],
  },
  [ID.WILLBENDER_FLAMES_ID_62618]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 0.22,
        hits: 1,
      },
    ],
  },
  [ID.REVERSAL_OF_FORTUNE]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [],
  },
  [ID.CRASHING_COURAGE_ID_62648]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: "guardian.virtue",
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
        name: "Crashing Courage — Initial Damage",
      },
    ],
  },
  [ID.RUSHING_JUSTICE]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: "guardian.virtue",
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
        hits: 1,
        name: "Rushing Justice — Impact Damage",
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 1,
        duration: 4,
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 1,
        duration: 2,
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 1,
        duration: 2,
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 1,
        duration: 2,
      },
    ],
  },
  [ID.REPOSE]: {
    implemented: true,
    castTimeMs: 250,
    effects: [],
  },
  [ID.QUICK_RETRIBUTION]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
      },
    ],
  }
});
