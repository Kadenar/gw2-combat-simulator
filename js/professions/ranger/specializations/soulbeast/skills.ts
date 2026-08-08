/** Explicit PvE skill mechanics owned by the Soulbeast Ranger module. */
import { RANGER_SKILL_IDS as ID } from "../../data/ids.js";
import type { SkillFragment } from "../../../../platform/engine/types.js";

export const SOULBEAST_BASE_SKILL_MECHANICS: Readonly<
  Record<number, SkillFragment>
> = Object.freeze({
  [ID.NARCOTIC_SPORES]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 0.6000000000000001,
        hits: 6,
      },
      {
        type: "condition",
        condition: "Confusion",
        stacks: 6,
        duration: 8,
      },
      {
        type: "condition",
        condition: "Confusion",
        stacks: 6,
        duration: 3,
      },
    ],
  },
  [ID.SMOKE_ASSAULT]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 0.5,
        hits: 1,
      },
      {
        type: "strike",
        coefficient: 0.35,
        hits: 1,
      },
      {
        type: "boon",
        boon: "might",
        duration: 8,
        stacks: 1,
      },
      {
        type: "boon",
        boon: "might",
        duration: 6,
        stacks: 1,
      },
    ],
  },
  [ID.VULTURE_STANCE]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    quicknessCastTimeMs: 0,
    handlerId: "ranger.vulture-stance",
  },
  [ID.PRIMAL_CRY]: {
    implemented: true,
    castTimeMs: 1250,
    effects: [
      {
        type: "condition",
        condition: "Poisoned",
        stacks: 3,
        duration: 6,
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 3,
        duration: 6,
      },
      {
        type: "strike",
        coefficient: 1.2000000000000002,
        hits: 3,
      },
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 9,
        duration: 6,
      },
    ],
    quicknessCastTimeMs: 833,
  },
  [ID.BITE]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 0.98,
        hits: 1,
      },
    ],
  },
  [ID.WORLDLY_IMPACT]: {
    implemented: true,
    castTimeMs: 1020,
    effects: [
      {
        type: "strike",
        ticks: [{ atMs: 520, coefficient: 1.89 }],
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
    quicknessCastTimeMs: 680,
  },
  [ID.RAIN_OF_SPIKES]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 2,
        duration: 5,
      },
    ],
  },
  [ID.MAUL_ID_41406]: {
    implemented: true,
    castTimeMs: 840,
    effects: [
      {
        type: "strike",
        ticks: [
          { atMs: 400, coefficient: 1.11 },
          { atMs: 440, coefficient: 1.11 },
        ],
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 2,
        duration: 6,
        atMs: 400,
        timingAnchor: "castStart",
        timingScale: "fixed",
      },
    ],
    quicknessCastTimeMs: 560,
  },
  [ID.DEVOURER_RETREAT]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
  },
  [ID.KICK]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 0.94,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 3,
        duration: 6,
      },
    ],
  },
  [ID.CHOMP]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
      },
    ],
  },
  [ID.TAIL_SWIPE]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 1.3,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Weakness",
        stacks: 1,
        duration: 5,
      },
    ],
  },
  [ID.DARK_WATER]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 0.1,
        hits: 1,
      },
    ],
  },
  [ID.WING_BUFFET]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 0.3,
        hits: 1,
      },
    ],
  },
  [ID.QUICKENING_SCREECH]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "boon",
        boon: "swiftness",
        duration: 10,
        stacks: 1,
      },
    ],
  },
  [ID.PROTECTION]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "boon",
        boon: "protection",
        duration: 10,
        stacks: 1,
      },
    ],
  },
  [ID.CHARGING_BITE]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 1.54,
        hits: 7,
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 7,
        duration: 10,
      },
    ],
  },
  [ID.WORLDLY_IMPACT_ID_42809]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 1.89,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.BRUTAL_CHARGE]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 0.64,
        hits: 1,
      },
    ],
  },
  [ID.TAKEDOWN]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Crippled",
        stacks: 1,
        duration: 3,
      },
    ],
  },
  [ID.BEASTMODE]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    handlerId: "ranger.beastmode-enter",
  },
  [ID.LEAVE_BEASTMODE]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
    handlerId: "ranger.beastmode-exit",
  },
  [ID.DEFY_PAIN]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
  },
  [ID.TAIL_LASH]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 0.5,
        hits: 1,
      },
    ],
  },
  [ID.BITE_ID_43136]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
      },
    ],
  },
  [ID.HEALING_CLOUD]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "boon",
        boon: "regeneration",
        duration: 3,
        stacks: 6,
      },
    ],
  },
  [ID.PRELUDE_LASH]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "strike",
        coefficient: 0.4,
        hits: 1,
      },
      {
        type: "strike",
        coefficient: 0.01,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 167,
  },
  [ID.FRENZIED_ATTACK]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 2,
        hits: 5,
      },
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 5,
        duration: 10,
      },
    ],
  },
  [ID.POISON_GAS]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "condition",
        condition: "Poisoned",
        stacks: 1,
        duration: 6,
      },
    ],
  },
  [ID.PHOTOSYNTHESIZE]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "boon",
        boon: "regeneration",
        duration: 5,
        stacks: 1,
      },
    ],
  },
  [ID.CRIPPLING_LEAP]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 0.98,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Crippled",
        stacks: 1,
        duration: 5,
      },
    ],
  },
  [ID.CALL_LIGHTNING_ID_43788]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 2.5,
        hits: 5,
      },
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 5,
        duration: 6,
      },
    ],
  },
  [ID.ENTANGLING_WEB]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 0.5,
        hits: 1,
      },
    ],
  },
  [ID.FEAR]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
  },
  [ID.CRIPPLING_ANGUISH]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 0.75,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Confusion",
        stacks: 3,
        duration: 3,
      },
      {
        type: "condition",
        condition: "Torment",
        stacks: 2,
        duration: 6,
      },
    ],
  },
  [ID.MAUL_ID_44514]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 1.4,
        hits: 2,
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 4,
        duration: 10,
      },
    ],
  },
  [ID.HARMONIC_CRY]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
  },
  [ID.SPIRITUAL_REPRIEVE]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [
      {
        type: "boon",
        boon: "resistance",
        duration: 3,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 667,
  },
  [ID.CHOMP_ID_44885]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 0.8,
        hits: 1,
      },
    ],
  },
  [ID.BEAR_STANCE]: {
    implemented: true,
    castTimeMs: 750,
    effects: [],
    quicknessCastTimeMs: 500,
  },
  [ID.SWOOP_ID_44991]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 1.2,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 5,
        duration: 6,
      },
    ],
  },
  [ID.GRIFFON_STANCE]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [
      {
        type: "boon",
        boon: "might",
        duration: 8,
        stacks: 2,
      },
      {
        type: "boon",
        boon: "might",
        duration: 6,
        stacks: 2,
      },
    ],
    quicknessCastTimeMs: 667,
  },
  [ID.SHARPEN_SPINES]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 1,
        duration: 5,
      },
    ],
  },
  [ID.ONE_WOLF_PACK]: {
    implemented: true,
    castTimeMs: 540,
    effects: [],
    quicknessCastTimeMs: 360,
    handlerId: "ranger.one-wolf-pack",
  },
  [ID.CHARGE]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 0.565,
        hits: 1,
        name: "Charge - Travel Damage",
      },
      {
        type: "strike",
        coefficient: 1.13,
        hits: 1,
        name: "Charge - Impact Damage",
      },
    ],
  },
  [ID.DOLYAK_STANCE]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "boon",
        boon: "stability",
        duration: 6,
        stacks: 6,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.UNFLINCHING_FORTITUDE]: {
    implemented: true,
    castTimeMs: 250,
    effects: [],
    quicknessCastTimeMs: 167,
  },
  [ID.MOA_STANCE]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "boon",
        boon: "protection",
        duration: 3,
        stacks: 1,
      },
      {
        type: "boon",
        boon: "fury",
        duration: 6,
        stacks: 1,
      },
      {
        type: "boon",
        boon: "swiftness",
        duration: 6,
        stacks: 1,
      },
      {
        type: "boon",
        boon: "regeneration",
        duration: 8,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.TAIL_LASH_ID_46386]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 1.2,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Crippled",
        stacks: 1,
        duration: 4,
      },
    ],
  },
  [ID.BRUTAL_CHARGE_ID_46432]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 0.67,
        hits: 1,
      },
      {
        type: "control",
        metadata: { controlKind: "knockdown" },
      },
    ],
  },
  [ID.ETERNAL_BOND]: {
    implemented: true,
    castTimeMs: 0,
    effects: [],
  },
  [ID.DASH]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 1.1,
        hits: 1,
      },
    ],
  },
  [ID.SLAM]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
      },
    ],
  },
  [ID.UNDEAD_PLAGUE]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 0.2,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Poisoned",
        stacks: 1,
        duration: 4,
      },
    ],
  },
  [ID.HEAVY_SHOT]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 1.2,
        hits: 1,
      },
    ],
  },
  [ID.PHASE_POUNCE]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 2,
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 2,
        duration: 5,
      },
    ],
  },
  [ID.LEY_LINE_VORTEX]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 2.8,
        hits: 8,
      },
      {
        type: "condition",
        condition: "Torment",
        stacks: 1,
        duration: 6,
      },
    ],
  },
  [ID.LUNGE]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Crippled",
        stacks: 1,
        duration: 5,
      },
    ],
  },
  [ID.ELECTROCUTE]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 8,
        duration: 8,
      },
    ],
  },
  [ID.SPIT_GOOP]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Crippled",
        stacks: 1,
        duration: 3,
      },
    ],
  },
  [ID.TORMENTING_VISIONS]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 0.8,
        hits: 4,
      },
      {
        type: "condition",
        condition: "Torment",
        stacks: 8,
        duration: 6,
      },
      {
        type: "condition",
        condition: "Torment",
        stacks: 4,
        duration: 6,
      },
    ],
  },
  [ID.STARING_VOID]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Confusion",
        stacks: 6,
        duration: 6,
      },
    ],
  },
  [ID.BATTLE_MAUL]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 1.75,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Crippled",
        stacks: 1,
        duration: 4,
      },
    ],
  },
  [ID.BOP]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
        hits: 1,
      },
    ],
  },
  [ID.BUMBLE]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
      },
    ],
  },
  [ID.STINGING_SORROW]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
        hits: 5,
      },
      {
        type: "condition",
        condition: "Poisoned",
        stacks: 5,
        duration: 7,
      },
    ],
  },
  [ID.LEAPING_LIZARD]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 2,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Crippled",
        stacks: 1,
        duration: 4,
      },
    ],
  },
  [ID.SAURIAN_MIGHT]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 2,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 4,
        duration: 8,
      },
    ],
  },
  [ID.TAIL_WHIP]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 1.3,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Crippled",
        stacks: 1,
        duration: 3,
      },
    ],
  },
  [ID.JET]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
      },
    ],
  },
});
