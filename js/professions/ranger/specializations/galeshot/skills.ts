/** Explicit PvE skill mechanics owned by the Galeshot Ranger module. */
import { RANGER_SKILL_IDS as ID } from "../../data/ids.js";
import type { SkillFragment } from "../../../../platform/engine/types.js";

export const GALESHOT_BASE_SKILL_MECHANICS: Readonly<
  Record<number, SkillFragment>
> = Object.freeze({
  [ID.WHIRLWIND]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 500,
  },
  [ID.MISTRAL]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.3,
        hits: 1,
      },
      {
        type: "strike",
        coefficient: 0.3,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Chilled",
        stacks: 1,
        duration: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.SUMMON_CYCLONE_BOW]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    handlerId: "ranger.cyclone-bow-enter",
  },
  [ID.PERFECT_STORM]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 2,
        hits: 1,
        name: "Perfect Storm - Traveling Tornado Damage",
      },
      {
        type: "strike",
        coefficient: 8.399999999999999,
        hits: 12,
        name: "Perfect Storm - Stationary Tornado Damage",
      },
    ],
    quicknessCastTimeMs: 500,
    arrowsRestored: 2,
    handlerId: "ranger.galeshot-arrows",
  },
  [ID.WIND_SHEAR]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
      },
      {
        type: "boon",
        boon: "aegis",
        duration: 3,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.DISMISS_CYCLONE_BOW]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    handlerId: "ranger.cyclone-bow-exit",
  },
  [ID.PIERCING_GALES]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 3.5,
        hits: 5,
      },
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 2,
        duration: 6,
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.SOOTHING_BREEZE]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 500,
  },
  [ID.KEEN_SHOT]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.75,
        hits: 1,
      },
    ],
    arrowCost: 0,
    quicknessCastTimeMs: 333,
  },
  [ID.HAWKEYE]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 6.8,
        hits: 5,
      },
    ],
    arrowCost: 0,
    handlerId: "ranger.cyclone-bow-skill",
    quicknessCastTimeMs: 667,
  },
  [ID.BLUSTER]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 1.92,
        hits: 3,
      },
    ],
    arrowCost: 1,
    handlerId: "ranger.cyclone-bow-skill",
    quicknessCastTimeMs: 500,
  },
  [ID.FLEETING_ZEPHYR]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.8,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Crippled",
        stacks: 1,
        duration: 4,
      },
    ],
    arrowCost: 1,
    handlerId: "ranger.cyclone-bow-skill",
    quicknessCastTimeMs: 167,
  },
  [ID.QUARRYS_PERIL]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 2.5,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Immobilized",
        stacks: 1,
        duration: 2,
      },
    ],
    arrowCost: 2,
    handlerId: "ranger.cyclone-bow-skill",
    quicknessCastTimeMs: 333,
  },
  [ID.PELT]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 2.5,
        hits: 1,
      },
    ],
    arrowCost: 1,
    handlerId: "ranger.cyclone-bow-skill",
    quicknessCastTimeMs: 333,
  },
  [ID.SUPERSONIC_ARROW]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 4,
        hits: 1,
      },
      {
        type: "control",
      },
    ],
    arrowCost: 3,
    handlerId: "ranger.cyclone-bow-skill",
    quicknessCastTimeMs: 667,
  },
});
