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
    quicknessCastTimeMs: 320,
    effects: [],
    arrowsRestored: 1,
    handlerId: "ranger.mistral",
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
        ticks: [{ atMs: 600, coefficient: 2 }],
        timingAnchor: "castStart",
        timingScale: "fixed",
        name: "Perfect Storm - Traveling Tornado Damage",
      },
      {
        type: "strike",
        ticks: [
          680, 1200, 1720, 2240, 2760, 3280, 3800, 4320, 4840, 5360, 5880, 6400,
        ].map((atMs) => ({ atMs, coefficient: 0.7 })),
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
        name: "Perfect Storm - Stationary Tornado Damage",
      },
      {
        type: "control",
        atMs: 600,
        timingAnchor: "castStart",
        timingScale: "fixed",
        metadata: { controlKind: "launch" },
      },
    ],
    quicknessCastTimeMs: 600,
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
        ticks: [480, 480, 520, 520, 600].map((atMs) => ({
          atMs,
          coefficient: 0.7,
        })),
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 2,
        duration: 6,
      },
    ],
    quicknessCastTimeMs: 640,
    arrowsRestored: 1,
    handlerId: "ranger.galeshot-arrows",
    missileHits: 5,
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
        ticks: [{ atMs: 480, coefficient: 0.75 }],
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
    arrowCost: 0,
    quicknessCastTimeMs: 480,
  },
  [ID.HAWKEYE]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [800, 920, 1040, 1160, 1280].map((atMs) => ({
          atMs,
          coefficient: 1.36,
        })),
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
      },
    ],
    arrowCost: 0,
    handlerId: "ranger.cyclone-bow-skill",
    quicknessCastTimeMs: 880,
  },
  [ID.BLUSTER]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [520, 600, 640].map((atMs) => ({
          atMs,
          coefficient: 0.64,
        })),
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
    arrowCost: 1,
    handlerId: "ranger.cyclone-bow-skill",
    quicknessCastTimeMs: 680,
    windForceGain: 1,
    windForceApplyMs: 480,
  },
  [ID.FLEETING_ZEPHYR]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [{ atMs: 280, coefficient: 0.8 }],
        timingAnchor: "castStart",
        timingScale: "fixed",
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
    quicknessCastTimeMs: 520,
    windForceGain: 1,
    windForceApplyMs: 240,
  },
  [ID.QUARRYS_PERIL]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [{ atMs: 800, coefficient: 2.5 }],
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
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
    quicknessCastTimeMs: 680,
    paletteInterruptMs: 320,
    interruptCommitMs: 320,
    retainsCastLockoutAfterInterrupt: true,
    windForceGain: 1,
    windForceApplyMs: 280,
  },
  [ID.PELT]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [{ atMs: 800, coefficient: 2.5 }],
        timingAnchor: "castStart",
        timingScale: "fixed",
        persistsAfterInterrupt: true,
      },
    ],
    arrowCost: 1,
    handlerId: "ranger.cyclone-bow-skill",
    quicknessCastTimeMs: 680,
    windForceGain: 1,
    windForceApplyMs: 280,
  },
  [ID.SUPERSONIC_ARROW]: {
    implemented: true,
    effects: [
      {
        type: "strike",
        ticks: [{ atMs: 800, coefficient: 4 }],
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "control",
        metadata: { controlKind: "daze" },
      },
    ],
    arrowCost: 3,
    handlerId: "ranger.cyclone-bow-skill",
    quicknessCastTimeMs: 1000,
    windForceGain: 2,
    windForceApplyMs: 760,
  },
});
