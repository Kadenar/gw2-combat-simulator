import { GUARDIAN_SKILL_IDS as ID } from "../../data/ids.js";
import type { SkillFragment } from "../../../../platform/engine/types.js";

export const DRAGONHUNTER_SKILL_MECHANICS: Readonly<
  Record<number, SkillFragment>
> = Object.freeze({
  [ID.TEST_OF_FAITH]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 1.4,
        hits: 1,
        atMs: 500,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
  },
  [ID.SPEAR_OF_JUSTICE]: {
    implemented: true,
    castTimeMs: 800,
    quicknessCastTimeMs: 560,
    cooldown: 20,
    handlerId: "guardian.dragonhunter-justice",
    effects: [],
  },
  [ID.PURIFICATION]: {
    implemented: true,
    castTimeMs: 660,
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: "strike",
        coefficient: 0.1875,
        hits: 1,
        atMs: 500,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "blind",
        metadata: {
          duration: 6,
        },
      },
    ],
  },
  [ID.SHIELD_OF_COURAGE]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: "guardian.virtue",
    effects: [],
  },
  [ID.WINGS_OF_RESOLVE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 25,
    handlerId: "guardian.dragonhunter-virtue",
    effects: [],
  },
  [ID.DRAGONS_MAW]: {
    implemented: true,
    castTimeMs: 660,
    effects: [
      {
        type: "strike",
        coefficient: 3.6,
        hits: 1,
        atMs: 500,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "control",
        metadata: {
          controlKind: "pull",
        },
      },
      {
        type: "condition",
        condition: "Slow",
        stacks: 1,
        duration: 4,
        atMs: 500,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "boon",
        boon: "Might",
        stacks: 10,
        duration: 8,
        atMs: 500,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
  },
  [ID.PROCESSION_OF_BLADES]: {
    implemented: true,
    castTimeMs: 660,
    effects: [
      {
        type: "strike",
        coefficient: 4.4,
        hits: 10,
        atMs: 1280,
        intervalMs: 280,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
  },
  [ID.FRAGMENTS_OF_FAITH]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
        hits: 1,
      },
    ],
  },
  [ID.LIGHTS_JUDGMENT]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "strike",
        coefficient: 0.1875,
        hits: 1,
      },
      {
        type: "control",
        metadata: {
          controlKind: "pull",
        },
      },
    ],
  },
  [ID.HUNTERS_VERDICT]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 40,
    handlerId: "guardian.hunters-verdict",
    effects: [
      {
        type: "control",
        metadata: {
          controlKind: "pull",
        },
      },
    ],
  },
  [ID.DRAGONS_MAW_ID_68686]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [
      {
        type: "strike",
        coefficient: 3.6,
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
});
