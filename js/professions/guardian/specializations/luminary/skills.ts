import { GUARDIAN_SKILL_IDS as ID } from "../../data/ids.js";
import { strikeTimeline } from "../../../../platform/engine/effect-factories.js";
import type { SkillFragment } from "../../../../platform/engine/types.js";

export const LUMINARY_SKILL_MECHANICS: Readonly<
  Record<number, SkillFragment>
> = Object.freeze({
  [ID.EXIT_RADIANT_FORGE]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: "guardian.radiant-forge",
    effects: [],
  },
  [ID.RESOLUTE_STANCE]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [],
  },
  [ID.DARING_ADVANCE]: {
    implemented: true,
    castTimeMs: 1000,
    quicknessCastTimeMs: 1000,
    effects: [
      {
        type: "strike",
        coefficient: 3,
        hits: 1,
      },
    ],
  },
  [ID.LUMINOUS_STAFF]: {
    implemented: true,
    castTimeMs: 750,
    quicknessCastTimeMs: 560,
    handlerId: "guardian.radiant-weapon",
    effects: [
      {
        type: "strike",
        coefficient: 1.2,
        hits: 4,
        intervalMs: 1000,
        name: "Luminous Staff — Symbol Damage",
        timingAnchor: "castEnd",
        timingScale: "fixed",
      },
    ],
  },
  [ID.EFFULGENT_STANCE]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
  },
  [ID.SHINING_SPIN]: {
    implemented: true,
    castTimeMs: 600,
    quicknessCastTimeMs: 480,
    handlerId: "guardian.radiant-weapon",
    effects: [
      {
        type: "strike",
        coefficient: 1.25,
        hits: 1,
        atMs: 1,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
  },
  [ID.GLEAMING_BLADE]: {
    implemented: true,
    castTimeMs: 1000,
    quicknessCastTimeMs: 840,
    handlerId: "guardian.radiant-weapon",
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
        hits: 1,
      },
    ],
  },
  [ID.BRILLIANT_SLAM]: {
    implemented: true,
    castTimeMs: 600,
    quicknessCastTimeMs: 480,
    handlerId: "guardian.radiant-weapon",
    effects: [
      {
        type: "strike",
        coefficient: 1.2,
        hits: 1,
      },
    ],
  },
  [ID.GLARING_BURST]: {
    implemented: true,
    castTimeMs: 750,
    quicknessCastTimeMs: 600,
    handlerId: "guardian.glaring-burst",
    effects: [],
  },
  [ID.ENTER_RADIANT_FORGE]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: "guardian.radiant-forge",
    effects: [],
  },
  [ID.PIERCING_STANCE]: {
    implemented: true,
    castTimeMs: 250,
    quicknessCastTimeMs: 200,
    effects: [
      {
        type: "strike",
        coefficient: 2,
        hits: 1,
      },
      {
        type: "control",
        metadata: {
          controlKind: "daze",
          duration: 0.5,
        },
      },
    ],
  },
  [ID.RESTORATIVE_GLOW]: {
    implemented: true,
    castTimeMs: 750,
    quicknessCastTimeMs: 560,
    handlerId: "guardian.radiant-weapon",
    effects: [],
  },
  [ID.RADIANT_BULWARK]: {
    implemented: true,
    castTimeMs: 2000,
    handlerId: "guardian.radiant-weapon",
    effects: [],
  },
  [ID.VALOROUS_STANCE]: {
    implemented: true,
    castTimeMs: 250,
    effects: [],
  },
  [ID.STALWART_STANCE]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "control",
        metadata: {
          controlKind: "control",
        },
      },
    ],
  },
  [ID.DAZZLING_HAMMER]: {
    implemented: true,
    castTimeMs: 600,
    quicknessCastTimeMs: 480,
    handlerId: "guardian.radiant-weapon",
    effects: [
      {
        type: "strike",
        coefficient: 1.2,
        hits: 1,
      },
      {
        type: "control",
        metadata: {
          controlKind: "daze",
          duration: 2,
        },
      },
    ],
  },
  [ID.LUCENT_THRUST]: {
    implemented: true,
    castTimeMs: 600,
    quicknessCastTimeMs: 440,
    handlerId: "guardian.radiant-weapon",
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
      },
      {
        type: "strike",
        coefficient: 0.8,
        hits: 1,
        name: "Lucent Thrust — Projectile Damage",
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
  [ID.RADIANT_COURAGE]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: "guardian.virtue",
    effects: [],
  },
  [ID.RADIANT_RESOLVE]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: "guardian.virtue",
    effects: [],
  },
  [ID.RADIANT_RESOLVE_ID_78604]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: "guardian.virtue",
    effects: [],
  },
  [ID.RADIANT_COURAGE_ID_78770]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: "guardian.virtue",
    effects: [],
  },
  [ID.RADIANT_JUSTICE]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: "guardian.virtue",
    effects: [],
  }
});
