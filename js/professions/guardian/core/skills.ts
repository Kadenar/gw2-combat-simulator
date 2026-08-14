import { GUARDIAN_SKILL_IDS as ID } from "../data/ids.js";
import { strikeTimeline } from "../../../platform/engine/effect-factories.js";
import type { Skill, SkillFragment } from "../../../platform/engine/types.js";

export const GUARDIAN_CORE_SKILL_MECHANICS: Readonly<
  Record<number, SkillFragment>
> = Object.freeze({
  [ID.LEAP_OF_FAITH]: {
    implemented: true,
    quicknessCastTimeMs: 720,
    effects: [
      {
        type: "strike",
        coefficient: 2,
        hits: 1,
      },
      {
        type: "blind",
      },
    ],
  },
  [ID.WHIRLING_WRATH]: {
    implemented: true,
    castTimeMs: 2200,
    effects: [
      strikeTimeline(
        [
          { atMs: 157, coefficient: 0.35 },
          { atMs: 314, coefficient: 0.275 },
          { atMs: 471, coefficient: 0.35 },
          { atMs: 628, coefficient: 0.275 },
          { atMs: 785, coefficient: 0.35 },
          { atMs: 942, coefficient: 0.275 },
          { atMs: 1099, coefficient: 0.35 },
          { atMs: 1257, coefficient: 0.275 },
          { atMs: 1414, coefficient: 0.35 },
          { atMs: 1571, coefficient: 0.275 },
          { atMs: 1728, coefficient: 0.35 },
          { atMs: 1885, coefficient: 0.275 },
          { atMs: 2042, coefficient: 0.35 },
          { atMs: 2200, coefficient: 0.275 },
        ],
        {
          timingAnchor: "castStart",
          timingScale: "cast",
        },
      ),
    ],
  },
  [ID.SHIELD_OF_WRATH]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 2.5,
        hits: 1,
        atMs: 4000,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
  },
  [ID.RECEIVE_THE_LIGHT]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [],
  },
  [ID.ADVANCE]: {
    implemented: true,
    castTimeMs: 250,
    effects: [],
  },
  [ID.SAVE_YOURSELVES]: {
    implemented: true,
    castTimeMs: 250,
    effects: [],
  },
  [ID.PROTECTORS_STRIKE]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 2,
        hits: 1,
      },
    ],
  },
  [ID.SHIELD_OF_JUDGMENT]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
      },
    ],
  },
  [ID.CLEANSING_FLAME]: {
    implemented: true,
    castTimeMs: 4000,
    effects: [
      {
        type: "strike",
        coefficient: 4,
        hits: 10,
        atMs: 400,
        intervalMs: 400,
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 2,
        duration: 4,
        atMs: 4000,
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  [ID.ZEALOTS_FIRE]: {
    implemented: true,
    castTimeMs: 250,
    quicknessCastTimeMs: 680,
    cooldown: 0,
    effects: [
      {
        type: "strike",
        ticks: [{ atMs: 480, coefficient: 2.25 }],
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 3,
        duration: 3,
        atMs: 480,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
  },
  [ID.SYMBOL_OF_PUNISHMENT]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "strike",
        coefficient: 2.5,
        hits: 5,
        atMs: 250,
        intervalMs: 1000,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
  },
  [ID.SHIELD_OF_ABSORPTION]: {
    implemented: true,
    castTimeMs: 750,
    effects: [],
  },
  [ID.BANE_SIGNET]: {
    implemented: true,
    quicknessCastTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 1,
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
  [ID.SYMBOL_OF_BLADES]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "strike",
        coefficient: 3.25,
        hits: 5,
        atMs: 250,
        intervalMs: 1000,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "blind",
      },
      {
        type: "boon",
        boon: "fury",
        duration: 2,
        stacks: 1,
      },
    ],
  },
  [ID.ORB_OF_WRATH]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 0.666,
        hits: 1,
      },
    ],
  },
  [ID.CHAINS_OF_LIGHT]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 0.25,
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
  [ID.SHELTER]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [],
  },
  [ID.ZEALOTS_FLAME]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 15,
    ammo: 1,
    ammoRecharge: 15,
    ammoCastLockout: 0,
    effects: [
      {
        type: "condition",
        condition: "Burning",
        stacks: 1,
        duration: 3,
        applications: 4,
        intervalMs: 1000,
        atMs: 0,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
  },
  [ID.SWORD_OF_WRATH]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 0.75,
        hits: 1,
      },
    ],
  },
  [ID.SWORD_ARC]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 0.8,
        hits: 1,
      },
    ],
  },
  [ID.ZEALOTS_DEFENSE]: {
    implemented: true,
    castTimeMs: 3000,
    effects: [
      {
        type: "strike",
        coefficient: 4.8,
        hits: 8,
        atMs: 375,
        intervalMs: 375,
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  [ID.FAITHFUL_STRIKE]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 1.55,
        hits: 1,
      },
    ],
  },
  [ID.TRUE_STRIKE]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 0.8,
        hits: 1,
      },
    ],
  },
  [ID.PURE_STRIKE]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
      },
    ],
  },
  [ID.SYMBOL_OF_FAITH]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 3.25,
        hits: 5,
        atMs: 750,
        intervalMs: 1000,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
  },
  [ID.RAY_OF_JUDGMENT]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 4.05,
        hits: 6,
        atMs: 750,
        intervalMs: 500,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "blind",
      },
    ],
  },
  [ID.JUSTICE]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: "guardian.virtue",
    effects: [],
  },
  [ID.COURAGE]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: "guardian.virtue",
    effects: [],
  },
  [ID.RESOLVE]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: "guardian.virtue",
    effects: [],
  },
  [ID.BOLT_OF_WRATH]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 0.65,
        hits: 1,
      },
    ],
  },
  [ID.BANISH]: {
    implemented: true,
    castTimeMs: 750,
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
  [ID.HAMMER_OF_WISDOM]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "strike",
        coefficient: 1.2,
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
  [ID.SANCTUARY]: {
    implemented: true,
    castTimeMs: 250,
    effects: [],
  },
  [ID.GREAT_SWORD_STRIKE]: {
    implemented: true,
    castTimeMs: 600,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
      },
    ],
  },
  [ID.GREAT_SWORD_VENGEFUL_STRIKE]: {
    implemented: true,
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: "strike",
        coefficient: 1.1,
        hits: 1,
      },
    ],
  },
  [ID.GREAT_SWORD_WRATHFUL_STRIKE]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
        hits: 1,
        atMs: 1000,
        timingAnchor: "castStart",
        timingScale: "cast",
      },
    ],
  },
  [ID.HOLY_STRIKE]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 1.8,
        hits: 1,
      },
    ],
  },
  [ID.SYMBOL_OF_SWIFTNESS]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 2.5,
        hits: 5,
      },
    ],
  },
  [ID.LINE_OF_WARDING]: {
    implemented: true,
    castTimeMs: 750,
    effects: [],
  },
  [ID.SYMBOL_OF_RESOLUTION]: {
    implemented: true,
    castTimeMs: 280,
    unaffectedByQuickness: true,
    effects: [
      {
        type: "strike",
        coefficient: 0.8,
        hits: 1,
        name: "Symbol of Resolution — Initial",
      },
      {
        type: "strike",
        coefficient: 2.6,
        hits: 4,
        atMs: 1000,
        intervalMs: 1000,
        timingAnchor: "castEnd",
        timingScale: "fixed",
        name: "Symbol of Resolution",
      },
    ],
  },
  [ID.BINDING_BLADE]: {
    implemented: true,
    quicknessCastTimeMs: 480,
    effects: [
      {
        type: "strike",
        coefficient: 2.5,
        hits: 1,
        atMs: 720,
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        coefficient: 0,
        hits: 10,
        atMs: 1000,
        intervalMs: 1000,
        timingAnchor: "castEnd",
        timingScale: "fixed",
        name: "Binding Blade — Tether",
        canCrit: false,
        sourceId: 9148,
        metadata: {
          flatStrikeBase: 160,
          flatStrikePowerCoeff: 0.3,
          damageKind: "condition",
        },
      },
      {
        type: "control",
        metadata: {
          controlKind: "control",
        },
      },
    ],
  },
  [ID.SIGNET_OF_JUDGMENT]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "strike",
        coefficient: 0.5,
        hits: 1,
      },
    ],
  },
  [ID.SIGNET_OF_WRATH]: {
    implemented: true,
    castTimeMs: 1000,
    cooldown: 18,
    effects: [
      {
        type: "strike",
        coefficient: 0.25,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 3,
        duration: 5,
      },
      {
        type: "condition",
        condition: "Immobilized",
        stacks: 1,
        duration: 6,
      },
    ],
  },
  [ID.HOLD_THE_LINE]: {
    implemented: true,
    castTimeMs: 250,
    effects: [],
  },
  [ID.STAND_YOUR_GROUND]: {
    implemented: true,
    castTimeMs: 250,
    effects: [],
  },
  [ID.RENEWED_FOCUS]: {
    implemented: true,
    castTimeMs: 2000,
    handlerId: "guardian.renewed-focus",
    effects: [],
  },
  [ID.SIGNET_OF_RESOLVE]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [],
  },
  [ID.HAMMER_SWING]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 0.8,
        hits: 1,
      },
    ],
  },
  [ID.HAMMER_BASH]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 0.8,
        hits: 1,
      },
    ],
  },
  [ID.SYMBOL_OF_PROTECTION]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
        name: "Symbol of Protection — Hammer Damage",
      },
      {
        type: "strike",
        coefficient: 1.5,
        hits: 3,
        name: "Symbol of Protection — Symbol Damage",
      },
    ],
  },
  [ID.SIGNET_OF_MERCY]: {
    implemented: true,
    castTimeMs: 250,
    effects: [],
  },
  [ID.SWORD_OF_JUSTICE]: {
    implemented: true,
    castTimeMs: 900,
    cooldown: 20,
    ammo: 3,
    effects: [
      {
        type: "strike",
        coefficient: 3.2,
        hits: 4,
        atMs: 650,
        intervalMs: 400,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
  },
  [ID.BOW_OF_TRUTH]: {
    implemented: true,
    castTimeMs: 250,
    effects: [],
  },
  [ID.SHIELD_OF_THE_AVENGER]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "strike",
        coefficient: 0.5,
        hits: 1,
      },
    ],
  },
  [ID.PURGING_FLAMES]: {
    implemented: true,
    castTimeMs: 250,
    quicknessCastTimeMs: 320,
    cooldown: 20,
    comboFields: [
      {
        ownerId: "guardian",
        fieldType: "Fire",
        duration: 5,
        startAnchor: "castEnd",
      },
    ],
    effects: [
      {
        type: "strike",
        ticks: [320, 1320, 2320, 3320, 4320, 5320].map((atMs) => ({
          atMs,
          coefficient: 0.2,
        })),
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 1,
        duration: 2,
        atMs: 320,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 1,
        duration: 2,
        atMs: 1320,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 1,
        duration: 2,
        atMs: 2320,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 1,
        duration: 2,
        atMs: 3320,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 1,
        duration: 2,
        atMs: 4320,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 1,
        duration: 2,
        atMs: 5320,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
  },
  [ID.MIGHTY_BLOW]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 2.4,
        hits: 1,
        comboFinishers: [
          {
            ownerId: "guardian",
            finisherType: "Blast",
            ambiguousFieldSelection: "oldest",
          },
        ],
      },
    ],
  },
  [ID.RING_OF_WARDING]: {
    implemented: true,
    castTimeMs: 750,
    effects: [],
  },
  [ID.SHIELD_OF_ABSORPTION_ID_9224]: {
    implemented: true,
    castTimeMs: 750,
    effects: [],
  },
  [ID.PULL]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "control",
        metadata: {
          controlKind: "control",
        },
      },
    ],
  },
  [ID.SWORD_WAVE]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 1.65,
        hits: 3,
      },
    ],
  },
  [ID.SMITE_CONDITION]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "strike",
        coefficient: 1.9,
        hits: 1,
        name: "Smite Condition — Damage With Condition",
      },
    ],
  },
  [ID.MERCIFUL_INTERVENTION]: {
    implemented: true,
    castTimeMs: 250,
    effects: [],
  },
  [ID.JUDGES_INTERVENTION]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "strike",
        coefficient: 0.5,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 1,
        duration: 8,
      },
    ],
  },
  [ID.CONTEMPLATION_OF_PURITY]: {
    implemented: true,
    castTimeMs: 250,
    effects: [],
  },
  [ID.VIRTUE_OF_RESOLVE]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: "guardian.virtue",
    effects: [],
  },
  [ID.WALL_OF_REFLECTION]: {
    implemented: true,
    castTimeMs: 250,
    effects: [],
  },
  [ID.HALLOWED_GROUND]: {
    implemented: true,
    castTimeMs: 250,
    effects: [],
  },
  [ID.ZEALOTS_EMBRACE]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 2.25,
        hits: 1,
      },
    ],
  },
  [ID.EMPOWER]: {
    implemented: true,
    castTimeMs: 750,
    effects: [],
  },
  [ID.VIRTUE_OF_COURAGE]: {
    implemented: true,
    castTimeMs: 0,
    handlerId: "guardian.virtue",
    effects: [],
  },
  [ID.SHIELD_OF_JUDGMENT_ID_15834]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
      },
    ],
  },
  [ID.LITANY_OF_WRATH]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [],
  },
  [ID.DEFLECTING_SHOT]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 1.8,
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
  [ID.SYMBOL_OF_ENERGY]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 1.38,
        hits: 1,
        name: "Symbol of Energy — Initial Damage",
      },
      {
        type: "strike",
        coefficient: 0.5175,
        hits: 5,
        intervalMs: 1000,
        name: "Symbol of Energy — Symbol Damage",
        timingAnchor: "castEnd",
        timingScale: "fixed",
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 1,
        duration: 12,
      },
    ],
  },
  [ID.FEEL_MY_WRATH]: {
    implemented: true,
    castTimeMs: 600,
    quicknessCastTimeMs: 400,
    cooldown: 30,
    effects: [
      {
        type: "boon",
        boon: "quickness",
        duration: 3,
        recipients: "allies",
      },
      {
        type: "boon",
        boon: "quickness",
        duration: 6,
        recipients: "self",
      },
      {
        type: "boon",
        boon: "fury",
        duration: 10,
        recipients: "party",
      },
    ],
  },
  [ID.TRUE_SHOT]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 2.8,
        hits: 1,
      },
    ],
  },
  [ID.SIGNET_OF_COURAGE]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [],
  },
  [ID.PUNCTURE_SHOT]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
      },
    ],
  },
  [ID.HUNTERS_WARD]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 0.75,
        hits: 1,
        name: "Hunter's Ward — Initial Damage",
      },
      {
        type: "strike",
        coefficient: 2.5,
        hits: 1,
        name: "Hunter's Ward — Final Impact Damage",
      },
    ],
  },
  [ID.SYMBOL_OF_VENGEANCE]: {
    implemented: true,
    castTimeMs: 750,
    quicknessCastTimeMs: 800,
    effects: [
      {
        type: "strike",
        ticks: [680, 1680, 2680, 3680, 4680].map((atMs) => ({
          atMs,
          coefficient: 0.6,
        })),
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 1,
        duration: 3,
        applications: 5,
        atMs: 680,
        intervalMs: 1000,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "boon",
        boon: "fury",
        duration: 1.5,
      },
      {
        type: "boon",
        boon: "fury",
        duration: 1.5,
        atMs: 1680,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "boon",
        boon: "fury",
        duration: 1.5,
        atMs: 2680,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "boon",
        boon: "fury",
        duration: 1.5,
        atMs: 3680,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "boon",
        boon: "fury",
        duration: 1.5,
        atMs: 4680,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "control",
        metadata: {
          controlKind: "daze",
        },
      },
    ],
  },
  [ID.SHIELD_OF_THE_AVENGER_ID_41571]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "strike",
        coefficient: 0.5,
        hits: 1,
      },
    ],
  },
  [ID.BOW_OF_TRUTH_ID_43565]: {
    implemented: true,
    castTimeMs: 250,
    effects: [],
  },
  [ID.SEARING_SLASH]: {
    implemented: true,
    castTimeMs: 500,
    quicknessCastTimeMs: 640,
    effects: [
      {
        type: "strike",
        ticks: [
          { atMs: 480, coefficient: 1.2 },
          { atMs: 640, coefficient: 1.2 },
        ],
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 2,
        duration: 2,
        atMs: 640,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
  },
  [ID.BLEEDING_EDGE]: {
    implemented: true,
    castTimeMs: 500,
    quicknessCastTimeMs: 680,
    effects: [
      {
        type: "strike",
        ticks: [
          { atMs: 480, coefficient: 0.36 },
          { atMs: 640, coefficient: 0.36 },
        ],
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 2,
        duration: 1,
        atMs: 640,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
  },
  [ID.SWORD_OF_JUSTICE_ID_44846]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "strike",
        coefficient: 3.2,
        hits: 4,
      },
    ],
  },
  [ID.CORE_CLEAVE]: {
    implemented: true,
    castTimeMs: 500,
    quicknessCastTimeMs: 640,
    effects: [
      {
        type: "strike",
        ticks: [
          { atMs: 360, coefficient: 0.36 },
          { atMs: 600, coefficient: 0.36 },
        ],
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 2,
        duration: 1,
        atMs: 600,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
  },
  [ID.BLAZING_EDGE]: {
    implemented: true,
    castTimeMs: 750,
    quicknessCastTimeMs: 520,
    effects: [
      {
        type: "strike",
        ticks: [{ atMs: 480, coefficient: 0.8 }],
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 1,
        duration: 3,
        atMs: 480,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "control",
        metadata: {
          controlKind: "pull",
        },
      },
    ],
  },
  [ID.HAMMER_OF_WISDOM_ID_46170]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "strike",
        coefficient: 1.2,
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
  [ID.SEEKING_JUDGMENT]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 0.9,
        hits: 1,
      },
    ],
  },
  [ID.SEARING_LIGHT]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 0.75,
        hits: 1,
      },
    ],
  },
  [ID.GLACIAL_BLOW]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 2.5,
        hits: 1,
        comboFinishers: [
          {
            ownerId: "guardian",
            finisherType: "Blast",
            ambiguousFieldSelection: "oldest",
          },
        ],
      },
      {
        type: "condition",
        condition: "Chilled",
        stacks: 1,
        duration: 2.5,
      },
    ],
  },
  [ID.EXECUTIONERS_CALLING]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 1.25,
        hits: 1,
      },
      {
        type: "strike",
        coefficient: 2.5,
        hits: 4,
        name: "Executioner's Calling — Secondary Attacks",
      },
    ],
  },
  [ID.ADVANCING_STRIKE]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 2.5,
        hits: 2,
      },
    ],
  },
  [ID.RENEWED_FOCUS_ID_68666]: {
    implemented: true,
    castTimeMs: 1000,
    handlerId: "guardian.renewed-focus",
    effects: [],
  },
  [ID.FEEL_MY_WRATH_ID_68670]: {
    implemented: true,
    castTimeMs: 600,
    quicknessCastTimeMs: 400,
    cooldown: 30,
    effects: [
      {
        type: "boon",
        boon: "quickness",
        duration: 3,
        recipients: "allies",
      },
      {
        type: "boon",
        boon: "quickness",
        duration: 6,
        recipients: "self",
      },
      {
        type: "boon",
        boon: "fury",
        duration: 10,
        recipients: "party",
      },
    ],
  },
  [ID.SIGNET_OF_COURAGE_ID_68676]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [],
  },
  [ID.JURISDICTION]: {
    implemented: true,
    castTimeMs: 750,
    quicknessCastTimeMs: 800,
    cooldown: 20,
    effects: [
      {
        type: "strike",
        ticks: [{ atMs: 640, coefficient: 3, metadata: { projectile: true } }],
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 5,
        duration: 6,
        atMs: 640,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "control",
        atMs: 640,
        timingAnchor: "castStart",
        timingScale: "fixed",
        metadata: {
          controlKind: "stun",
        },
      },
    ],
  },
  [ID.HAIL_OF_JUSTICE]: {
    implemented: true,
    castTimeMs: 250,
    quicknessCastTimeMs: 1120,
    cooldown: 10,
    ammo: 2,
    ammoRecharge: 10,
    ammoCastLockout: 1,
    effects: [
      {
        type: "strike",
        ticks: [280, 440, 640, 800, 960].map((atMs) => ({
          atMs,
          coefficient: 0.3,
          metadata: { projectile: true },
        })),
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "condition",
        ticks: [280, 440, 640, 800, 960].map((atMs) => ({
          atMs,
          condition: "Bleeding",
          stacks: 1,
          duration: 8,
          metadata: { projectile: true },
        })),
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "condition",
        ticks: [280, 440, 640, 800, 960].map((atMs) => ({
          atMs,
          condition: "Crippled",
          stacks: 1,
          duration: 1,
          metadata: { projectile: true },
        })),
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
  },
  [ID.PEACEKEEPER]: {
    implemented: true,
    castTimeMs: 500,
    quicknessCastTimeMs: 1040,
    cooldown: 6,
    rechargeAnchor: "castStart",
    effects: [
      {
        type: "strike",
        ticks: [280, 480, 640, 800, 960].map((atMs) => ({
          atMs,
          coefficient: 0.25,
        })),
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 1,
        duration: 1.5,
        atMs: 280,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 1,
        duration: 1.5,
        atMs: 480,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 1,
        duration: 1.5,
        atMs: 640,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 1,
        duration: 1.5,
        atMs: 800,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 1,
        duration: 1.5,
        atMs: 960,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
  },
  [ID.SYMBOL_OF_IGNITION]: {
    implemented: true,
    castTimeMs: 250,
    quicknessCastTimeMs: 360,
    comboFields: [
      {
        ownerId: "guardian",
        fieldType: "Light",
        duration: 4,
        startAnchor: "castEnd",
      },
    ],
    effects: [
      {
        type: "strike",
        ticks: [280, 960, 1640, 2320, 3000].map((atMs) => ({
          atMs,
          coefficient: 0.4,
        })),
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      ...[280, 960, 1640, 2320, 3000].map((atMs) => ({
        type: "boon" as const,
        boon: "might",
        stacks: 1,
        duration: 5,
        recipients: "party",
        atMs,
        timingAnchor: "castStart" as const,
        timingScale: "fixed" as const,
      })),
    ],
  },
  [ID.THROUGH_THE_HEART]: {
    implemented: true,
    castTimeMs: 500,
    quicknessCastTimeMs: 600,
    effects: [
      {
        type: "strike",
        ticks: [
          { atMs: 360, coefficient: 0.6, metadata: { projectile: true } },
        ],
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 1,
        duration: 8,
        atMs: 360,
        timingAnchor: "castStart",
        timingScale: "fixed",
        metadata: { projectile: true },
      },
    ],
  },
  [ID.HELIO_RUSH]: {
    implemented: true,
    quicknessCastTimeMs: 320,
    cooldown: 6.4,
    ammo: 2,
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
        hits: 1,
        atMs: 160,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "boon",
        boon: "Resolution",
        duration: 4,
        atMs: 160,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
  },
  [ID.GLEAMING_DISC]: {
    implemented: true,
    quicknessCastTimeMs: 560,
    cooldown: 9.6,
    effects: [
      {
        type: "strike",
        coefficient: 3,
        hits: 2,
        atMs: 0,
        intervalMs: 680,
        name: "Gleaming Disc",
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
  },
  [ID.DAYBREAKING_SLASH]: {
    implemented: true,
    castTimeMs: 520,
    effects: [
      {
        type: "strike",
        coefficient: 0.7,
        hits: 1,
      },
    ],
  },
  [ID.SOLAR_STORM]: {
    implemented: true,
    castTimeMs: 560,
    unaffectedByQuickness: true,
    cooldown: 15,
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
        hits: 1,
        atMs: 560,
        name: "Solar Storm — 1st Strike",
        timingAnchor: "castStart",
        timingScale: "cast",
      },
      {
        type: "strike",
        coefficient: 1.2,
        hits: 1,
        atMs: 760,
        name: "Solar Storm — 2nd Strike",
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "strike",
        coefficient: 0.9,
        hits: 1,
        atMs: 960,
        name: "Solar Storm — 3rd Strike",
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
  },
  [ID.SYMBOL_OF_LUMINANCE]: {
    implemented: true,
    castTimeMs: 440,
    unaffectedByQuickness: true,
    cooldown: 15,
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
        hits: 1,
        atMs: 360,
        name: "Symbol of Luminance — Initial",
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "strike",
        coefficient: 2.5,
        hits: 5,
        atMs: 360,
        intervalMs: 1000,
        name: "Symbol of Luminance",
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
  },
});

export const GUARDIAN_CORE_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
  Object.freeze({
    id: -3,
    name: "Swap Weapons",
    icon: "",
    type: "Action",
    slot: "Action",
    weapon: "",
    specialization: undefined,
    categories: [],
    recharge: 10,
    ammo: 0,
    ammoRecharge: 0,
    nextChainId: null,
    flipSkillId: null,
    castTimeMs: 0,
    rechargeAnchor: "castStart",
    cooldown: 10,
    implemented: true,
    handlerId: "guardian.weapon-swap",
    effects: [],
  }),
]);
