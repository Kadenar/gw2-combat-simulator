/** Explicit PvE skill mechanics owned by the Druid Ranger module. */
import { RANGER_SKILL_IDS as ID } from "../../data/ids.js";
import type { SkillFragment } from "../../../../platform/engine/types.js";

export const DRUID_BASE_SKILL_MECHANICS: Readonly<
  Record<number, SkillFragment>
> = Object.freeze({
  [ID.GLYPH_OF_THE_TIDES]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333,
  },
  [ID.GLYPH_OF_ALIGNMENT]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333,
  },
  [ID.GLYPH_OF_REJUVENATION]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333,
  },
  [ID.RELEASE_CELESTIAL_AVATAR]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    handlerId: "ranger.celestial-avatar-exit",
  },
  [ID.GLYPH_OF_BURGEONING]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333,
  },
  [ID.GLYPH_OF_THE_STARS]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 667,
  },
  [ID.GLYPH_OF_EQUALITY]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333,
  },
  [ID.CELESTIAL_AVATAR]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    handlerId: "ranger.celestial-avatar-enter",
  },
  [ID.COSMIC_RAY]: {
    implemented: true,
    effects: [],
    quicknessCastTimeMs: 333,
  },
  [ID.SEED_OF_LIFE]: {
    implemented: true,
    effects: [
      {
        type: "blind",
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.LUNAR_IMPACT]: {
    implemented: true,
    effects: [
      {
        type: "control",
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.REJUVENATING_TIDES]: {
    implemented: true,
    effects: [
      {
        type: "boon",
        boon: "might",
        duration: 10,
        stacks: 5,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.NATURAL_CONVERGENCE]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.75,
        hits: 4,
        atMs: 0,
        intervalMs: 500,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "strike",
        coefficient: 2,
        hits: 1,
        atMs: 2500,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "condition",
        condition: "Immobilized",
        stacks: 4,
        duration: 2,
      },
      {
        type: "control",
      },
    ],
    quicknessCastTimeMs: 1667,
  },
});
