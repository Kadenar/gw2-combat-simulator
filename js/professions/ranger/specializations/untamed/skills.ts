/** Explicit PvE skill mechanics owned by the Untamed Ranger module. */
import { RANGER_SKILL_IDS as ID } from "../../data/ids.js";
import type { SkillFragment } from "../../../../platform/engine/types.js";

export const UNTAMED_BASE_SKILL_MECHANICS: Readonly<
  Record<number, SkillFragment>
> = Object.freeze({
  [ID.ENVELOPING_HAZE]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 1.75,
        hits: 5,
      },
      {
        type: "strike",
        coefficient: 0.5,
        hits: 5,
      },
      {
        type: "condition",
        condition: "Chilled",
        stacks: 1,
        duration: 1,
      },
    ],
  },
  [ID.NATURES_BINDING]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 500,
  },
  [ID.UNLEASH_RANGER]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    handlerId: "ranger.unleash-ranger",
  },
  [ID.EXPLODING_SPORES]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 2.64,
        hits: 6,
      },
      {
        type: "condition",
        condition: "Poisoned",
        stacks: 1,
        duration: 5,
      },
    ],
    quicknessCastTimeMs: 167,
  },
  [ID.FORESTS_FORTIFICATION]: {
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "stability",
        duration: 6,
        stacks: 10,
      },
      {
        type: "boon",
        boon: "resistance",
        duration: 6,
        stacks: 1,
      },
      {
        type: "boon",
        boon: "resolution",
        duration: 6,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 667,
  },
  [ID.UNNATURAL_TRAVERSAL]: {
    implemented: true,
    effects: [
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 10,
        duration: 6,
      },
    ],
    quicknessCastTimeMs: 167,
  },
  [ID.VENOMOUS_OUTBURST]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
      },
      {
        type: "strike",
        coefficient: 0.1,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Poisoned",
        stacks: 1,
        duration: 6,
      },
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 8,
        duration: 6,
      },
      {
        type: "condition",
        condition: "Poisoned",
        stacks: 3,
        duration: 8,
      },
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 8,
        duration: 10,
      },
    ],
  },
  [ID.MUTATE_CONDITIONS]: {
    implemented: true,
    effects: [
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 1,
        duration: 6,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.RENDING_VINES]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 1.3,
        hits: 1,
      },
      {
        type: "strike",
        coefficient: 0.1,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Slow",
        stacks: 1,
        duration: 4,
      },
    ],
  },
  [ID.PERILOUS_GIFT]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 500,
  },
  [ID.UNLEASH_PET]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    handlerId: "ranger.unleash-pet",
  },
});
