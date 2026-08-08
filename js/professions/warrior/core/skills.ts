/** Explicit PvE skill mechanics owned by the Core Warrior module. */
import { WARRIOR_SKILL_IDS as ID } from "../data/ids.js";
import type { SkillFragment } from "../../../platform/engine/types.js";

export const WARRIOR_CORE_SKILL_MECHANICS: Readonly<
  Record<number, SkillFragment>
> = Object.freeze({
  [ID.EVISCERATE]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "boon",
        boon: "might",
        duration: 5,
        stacks: 5,
      },
      {
        type: "strike",
        coefficient: 2,
        hits: 1,
        name: "Eviscerate — Level 1 Damage",
      },
    ],
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: "warrior.resource",
  },
  [ID.THROW_BOLAS]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 0.25,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.SIGNET_OF_RAGE]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "boon",
        boon: "fury",
        duration: 25,
        stacks: 1,
      },
      {
        type: "boon",
        boon: "might",
        duration: 25,
        stacks: 5,
      },
      {
        type: "boon",
        boon: "swiftness",
        duration: 25,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 167,
    adrenalineGain: 2,
    handlerId: "warrior.resource",
  },
  [ID.GREATSWORD_SWING]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 0.8,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 1,
        duration: 8,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.HAMMER_SWING]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 0.9,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.STAGGERING_BLOW]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
        hits: 1,
      },
      {
        type: "control",
        metadata: {
          controlKind: "knockback",
        },
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.RIFLE_BUTT]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
      },
      {
        type: "control",
        metadata: {
          controlKind: "knockback",
        },
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.SHIELD_BASH]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
      },
      {
        type: "control",
        metadata: {
          controlKind: "stun",
          duration: 2,
        },
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.SHIELD_STANCE]: {
    implemented: true,
    castTimeMs: 3000,
    effects: [],
    quicknessCastTimeMs: 2000,
  },
  [ID.HAMSTRING]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "strike",
        coefficient: 1.2,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 1,
        duration: 6,
      },
      {
        type: "condition",
        condition: "Crippled",
        stacks: 1,
        duration: 1,
      },
    ],
    quicknessCastTimeMs: 167,
  },
  [ID.SEVER_ARTERY]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 0.8,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 1,
        duration: 6,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.GASH]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 0.8,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 1,
        duration: 6,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.SAVAGE_LEAP]: {
    implemented: true,
    castTimeMs: 750,
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
        duration: 3,
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 3,
        duration: 5,
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.FRENZY]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "boon",
        boon: "quickness",
        duration: 6,
        stacks: 1,
      },
      {
        type: "boon",
        boon: "might",
        duration: 6,
        stacks: 10,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.CHOP]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "strike",
        coefficient: 0.7,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 167,
  },
  [ID.DOUBLE_CHOP]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "strike",
        coefficient: 0.45,
        hits: 1,
        name: "Double Chop — First Chop Damage",
      },
      {
        type: "strike",
        coefficient: 1.05,
        hits: 1,
        name: "Double Chop — Second Chop Damage",
      },
    ],
    quicknessCastTimeMs: 167,
  },
  [ID.TRIPLE_CHOP]: {
    implemented: true,
    castTimeMs: 1500,
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
        hits: 2,
      },
      {
        type: "strike",
        coefficient: 1.6,
        hits: 1,
        name: "Triple Chop — Final chop damage.",
      },
    ],
    quicknessCastTimeMs: 1000,
  },
  [ID.SHAKE_IT_OFF]: {
    implemented: true,
    castTimeMs: 500,
    effects: [],
    quicknessCastTimeMs: 333,
  },
  [ID.GREATSWORD_SLICE]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 1.05,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 1,
        duration: 8,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.BRUTAL_STRIKE]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.ARCING_SLICE]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 2,
        hits: 1,
        coefficientModifiers: [
          {
            kind: "target-health-below",
            threshold: 0.5,
            multiplier: 1.5,
          },
        ],
      },
      {
        type: "boon",
        boon: "fury",
        duration: 8,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: "warrior.resource",
  },
  [ID.MACE_SMASH]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 0.8,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.MACE_BASH]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 0.8,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.PULVERIZE]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 1.6,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Weakness",
        stacks: 1,
        duration: 5,
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.ARCING_ARROW]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 2.5,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 1,
        duration: 5,
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.HAMMER_BASH]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 0.9,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.HAMMER_SMASH]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 1.2,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.FIERCE_BLOW]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 1.8,
        hits: 1,
      },
      {
        type: "strike",
        coefficient: 2.7,
        hits: 1,
        name: "Fierce Blow — Damage to Controlled or Defiant Foes",
      },
      {
        type: "condition",
        condition: "Weakness",
        stacks: 1,
        duration: 4,
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.EARTHSHAKER]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 2.75,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 500,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: "warrior.resource",
  },
  [ID.STOMP]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 0.75,
        hits: 1,
      },
      {
        type: "boon",
        boon: "stability",
        duration: 6,
        stacks: 1,
      },
      {
        type: "control",
        metadata: {
          controlKind: "launch",
        },
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.HEALING_SIGNET]: {
    implemented: true,
    castTimeMs: 1250,
    effects: [
      {
        type: "boon",
        boon: "resistance",
        duration: 6,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 833,
  },
  [ID.ENDURE_PAIN]: {
    implemented: true,
    castTimeMs: 500,
    effects: [],
    quicknessCastTimeMs: 333,
  },
  [ID.CHARGE]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "boon",
        boon: "swiftness",
        duration: 20,
        stacks: 1,
      },
      {
        type: "boon",
        boon: "quickness",
        duration: 2,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.CALL_OF_VALOR]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "boon",
        boon: "vigor",
        duration: 10,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.KILL_SHOT]: {
    implemented: true,
    castTimeMs: 1250,
    effects: [
      {
        type: "strike",
        coefficient: 2.25,
        hits: 1,
        name: "Kill Shot — Level 1 Damage",
      },
    ],
    quicknessCastTimeMs: 833,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: "warrior.resource",
  },
  [ID.THROW_AXE]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "strike",
        coefficient: 0.85,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Crippled",
        stacks: 1,
        duration: 4,
      },
    ],
    quicknessCastTimeMs: 167,
  },
  [ID.WHIRLING_AXE]: {
    implemented: true,
    castTimeMs: 3500,
    effects: [
      {
        type: "strike",
        coefficient: 8.388,
        hits: 15,
      },
    ],
    quicknessCastTimeMs: 2333,
  },
  [ID.RIPOSTE]: {
    implemented: true,
    castTimeMs: 2250,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 8,
        duration: 8,
      },
    ],
    quicknessCastTimeMs: 1500,
  },
  [ID.MENDING]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [],
    quicknessCastTimeMs: 667,
  },
  [ID.TO_THE_LIMIT]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [],
    quicknessCastTimeMs: 667,
    adrenalineGain: 30,
    handlerId: "warrior.resource",
  },
  [ID.FOR_GREAT_JUSTICE]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "boon",
        boon: "fury",
        duration: 8,
        stacks: 1,
      },
      {
        type: "boon",
        boon: "might",
        duration: 25,
        stacks: 6,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.SIGNET_OF_MIGHT]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "boon",
        boon: "might",
        duration: 6,
        stacks: 10,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.BANNER_OF_STRENGTH]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "boon",
        boon: "might",
        duration: 10,
        stacks: 2,
      },
      {
        type: "strike",
        coefficient: 2,
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
    quicknessCastTimeMs: 500,
  },
  [ID.BERSERKER_STANCE]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "boon",
        boon: "resistance",
        duration: 1,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 333,
    adrenalineGain: 7,
    handlerId: "warrior.resource",
  },
  [ID.BANNER_OF_DISCIPLINE]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "boon",
        boon: "fury",
        duration: 4,
        stacks: 1,
      },
      {
        type: "strike",
        coefficient: 0.5,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 3,
        duration: 8,
      },
      {
        type: "condition",
        condition: "Crippled",
        stacks: 1,
        duration: 10,
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.BANNER_OF_TACTICS]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "boon",
        boon: "stability",
        duration: 5,
        stacks: 5,
      },
      {
        type: "boon",
        boon: "resistance",
        duration: 2,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 167,
  },
  [ID.FEAR_ME]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "condition",
        condition: "Weakness",
        stacks: 1,
        duration: 6,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.SIGNET_OF_FURY]: {
    implemented: true,
    castTimeMs: 500,
    effects: [],
    quicknessCastTimeMs: 333,
    adrenalineGain: 30,
    handlerId: "warrior.resource",
  },
  [ID.BALANCED_STANCE]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "boon",
        boon: "stability",
        duration: 1,
        stacks: 2,
      },
      {
        type: "boon",
        boon: "swiftness",
        duration: 3,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.DOLYAK_SIGNET]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "boon",
        boon: "stability",
        duration: 8,
        stacks: 10,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.SKULL_CRACK]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: "warrior.resource",
  },
  [ID.TREMOR]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 1.25,
        hits: 1,
      },
      {
        type: "control",
        metadata: {
          controlKind: "knockdown",
          duration: 3,
        },
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.VOLLEY]: {
    implemented: true,
    castTimeMs: 2500,
    effects: [
      {
        type: "strike",
        coefficient: 4,
        hits: 5,
      },
    ],
    quicknessCastTimeMs: 1667,
  },
  [ID.DUAL_STRIKE]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 2.35,
        hits: 2,
      },
      {
        type: "boon",
        boon: "quickness",
        duration: 2,
        stacks: 2,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.BATTLE_STANDARD]: {
    implemented: true,
    castTimeMs: 2000,
    effects: [
      {
        type: "strike",
        coefficient: 4,
        hits: 1,
      },
      {
        type: "boon",
        boon: "might",
        duration: 12,
        stacks: 2,
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
        duration: 12,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 1333,
  },
  [ID.CYCLONE_AXE]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 1.76,
        hits: 2,
      },
      {
        type: "boon",
        boon: "fury",
        duration: 2,
        stacks: 1,
      },
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 3,
        duration: 8,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.EVISCERATE_ID_14422]: {
    implemented: true,
    castTimeMs: 0,
    effects: [
      {
        type: "strike",
        coefficient: 2,
        hits: 1,
        name: "Eviscerate — Level 1 Damage",
      },
      {
        type: "boon",
        boon: "might",
        duration: 5,
        stacks: 5,
      },
    ],
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
  },
  [ID.SKULL_CRACK_ID_14425]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
  },
  [ID.DUAL_SHOT]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 1.05,
        hits: 2,
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.FIERCE_SHOT]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
      },
      {
        type: "boon",
        boon: "might",
        duration: 5,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.WHIRLING_STRIKE]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 2,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 500,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: "warrior.resource",
  },
  [ID.RUSH]: {
    implemented: true,
    castTimeMs: 2000,
    effects: [
      {
        type: "strike",
        coefficient: 2.5,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 1333,
  },
  [ID.WHIRLWIND_ATTACK]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [
      {
        type: "strike",
        coefficient: 0.665,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 667,
  },
  [ID.FORCEFUL_SHOT]: {
    implemented: true,
    castTimeMs: 1750,
    effects: [
      {
        type: "strike",
        coefficient: 2.25,
        hits: 1,
        name: "Forceful Shot — Level 1 Damage",
      },
    ],
    quicknessCastTimeMs: 1167,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
  },
  [ID.EXPLOSIVE_SHELL]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 1.6,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Crippled",
        stacks: 1,
        duration: 5,
      },
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 10,
        duration: 10,
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.KILL_SHOT_ID_14473]: {
    implemented: true,
    castTimeMs: 1250,
    effects: [
      {
        type: "strike",
        coefficient: 2.25,
        hits: 1,
        name: "Kill Shot — Level 1 Damage",
      },
    ],
    quicknessCastTimeMs: 833,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
  },
  [ID.KILL_SHOT_ID_14474]: {
    implemented: true,
    castTimeMs: 1250,
    effects: [
      {
        type: "strike",
        coefficient: 2.25,
        hits: 1,
        name: "Kill Shot — Level 1 Damage",
      },
    ],
    quicknessCastTimeMs: 833,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
  },
  [ID.KILL_SHOT_ID_14475]: {
    implemented: true,
    castTimeMs: 1250,
    effects: [
      {
        type: "strike",
        coefficient: 2.25,
        hits: 1,
        name: "Kill Shot — Level 1 Damage",
      },
    ],
    quicknessCastTimeMs: 833,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
  },
  [ID.SIGNET_OF_STAMINA]: {
    implemented: true,
    castTimeMs: 500,
    effects: [],
    quicknessCastTimeMs: 333,
  },
  [ID.HAMMER_SHOCK]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 1.8,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Crippled",
        stacks: 1,
        duration: 7,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.RAMPAGE]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [
      {
        type: "boon",
        boon: "swiftness",
        duration: 3,
        stacks: 1,
      },
      {
        type: "boon",
        boon: "stability",
        duration: 3,
        stacks: 2,
      },
    ],
    quicknessCastTimeMs: 667,
  },
  [ID.IMPALE]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Torment",
        stacks: 5,
        duration: 8,
      },
      {
        type: "condition",
        condition: "Crippled",
        stacks: 5,
        duration: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.RIP]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 2,
        hits: 1,
      },
      {
        type: "boon",
        boon: "might",
        duration: 5,
        stacks: 10,
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.KICK]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
      },
      {
        type: "control",
        metadata: {
          controlKind: "knockback",
        },
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.POMMEL_BASH]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 0.4,
        hits: 1,
      },
      {
        type: "control",
        metadata: {
          controlKind: "daze",
          duration: 1,
        },
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.PIN_DOWN]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 0.44,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 6,
        duration: 12,
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.SMOLDERING_ARROW]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "strike",
        coefficient: 0.2,
        hits: 1,
      },
      {
        type: "control",
        metadata: {
          controlKind: "daze",
          duration: 1,
        },
      },
    ],
    quicknessCastTimeMs: 167,
  },
  [ID.COMBUSTIVE_SHOT]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 2,
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 1,
        duration: 5,
      },
    ],
    quicknessCastTimeMs: 500,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: "warrior.resource",
  },
  [ID.COUNTERBLOW]: {
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
        duration: 8,
      },
    ],
    quicknessCastTimeMs: 333,
    adrenalineGain: 5,
    handlerId: "warrior.resource",
  },
  [ID.BLADETRAIL]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.BACKBREAKER]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [
      {
        type: "strike",
        coefficient: 2.25,
        hits: 1,
      },
      {
        type: "control",
        metadata: {
          controlKind: "knockdown",
          duration: 3,
        },
      },
    ],
    quicknessCastTimeMs: 667,
  },
  [ID.EARTHSHAKER_ID_14512]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 2.75,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 500,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
  },
  [ID.BULLS_CHARGE]: {
    implemented: true,
    castTimeMs: 1000,
    effects: [
      {
        type: "strike",
        coefficient: 2,
        hits: 1,
      },
      {
        type: "control",
        metadata: {
          controlKind: "knockdown",
          duration: 3,
        },
      },
    ],
    quicknessCastTimeMs: 667,
  },
  [ID.CRUSHING_BLOW]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 2.25,
        hits: 1,
      },
      {
        type: "boon",
        boon: "might",
        duration: 6,
        stacks: 3,
      },
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 10,
        duration: 6,
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.FAN_OF_FIRE]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "strike",
        coefficient: 1.32,
        hits: 3,
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 3,
        duration: 3,
      },
    ],
    quicknessCastTimeMs: 167,
  },
  [ID.COMBUSTIVE_SHOT_ID_14520]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 2,
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 2,
        duration: 5,
      },
    ],
    quicknessCastTimeMs: 500,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
  },
  [ID.BANNER_OF_DEFENSE]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "boon",
        boon: "aegis",
        duration: 5,
        stacks: 1,
      },
      {
        type: "boon",
        boon: "regeneration",
        duration: 4,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 167,
  },
  [ID.FORCEFUL_SHOT_ID_14544]: {
    implemented: true,
    castTimeMs: 1750,
    effects: [
      {
        type: "strike",
        coefficient: 2.25,
        hits: 1,
        name: "Forceful Shot — Level 1 Damage",
      },
    ],
    quicknessCastTimeMs: 1167,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: "warrior.resource",
  },
  [ID.ARCING_SLICE_ID_14545]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 2,
        hits: 1,
        coefficientModifiers: [
          {
            kind: "target-health-below",
            threshold: 0.5,
            multiplier: 0.91,
          },
        ],
      },
      {
        type: "boon",
        boon: "fury",
        duration: 8,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
  },
  [ID.TACTICAL_BLOW]: {
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
        stacks: 5,
        duration: 8,
      },
    ],
    quicknessCastTimeMs: 333,
    adrenalineGain: 5,
    handlerId: "warrior.resource",
  },
  [ID.WHIRLING_STRIKE_ID_14549]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 2,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 500,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
  },
  [ID.HUNDRED_BLADES]: {
    implemented: true,
    castTimeMs: 3500,
    effects: [
      {
        type: "strike",
        coefficient: 6.2,
        hits: 8,
      },
      {
        type: "strike",
        coefficient: 1.5,
        hits: 1,
        name: "Hundred Blades — Final Strike Damage",
      },
    ],
    quicknessCastTimeMs: 2333,
  },
  [ID.ADRENALINE_RUSH]: {
    implemented: true,
    castTimeMs: 500,
    effects: [],
    quicknessCastTimeMs: 333,
    adrenalineGain: 3,
    handlerId: "warrior.resource",
  },
  [ID.ON_MY_MARK]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 15,
        duration: 6,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.DEFIANT_STANCE]: {
    implemented: true,
    castTimeMs: 750,
    effects: [],
    quicknessCastTimeMs: 500,
  },
  [ID.BLAZE_BREAKER]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 2,
        hits: 5,
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 1,
        duration: 6,
      },
      {
        type: "condition",
        condition: "Crippled",
        stacks: 1,
        duration: 3,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.FLAMES_OF_WAR]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Burning",
        stacks: 1,
        duration: 2,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.BRUTAL_SHOT]: {
    implemented: true,
    castTimeMs: 750,
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
        duration: 12,
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.KEEN_STRIKE]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "strike",
        coefficient: 1.05,
        hits: 1,
      },
      {
        type: "boon",
        boon: "might",
        duration: 5,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 167,
  },
  [ID.FOCUSED_SLASH]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "strike",
        coefficient: 0.65,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 167,
  },
  [ID.PRECISE_CUT]: {
    implemented: true,
    castTimeMs: 250,
    effects: [
      {
        type: "strike",
        coefficient: 0.6,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 167,
  },
  [ID.WASTRELS_RUIN]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.DISRUPTING_STAB]: {
    implemented: true,
    castTimeMs: 500,
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
        },
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.HUSHBLADE]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
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
    quicknessCastTimeMs: 333,
  },
  [ID.BREACHING_STRIKE]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 2.5,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 500,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: "warrior.resource",
  },
  [ID.AURA_SLICER]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 1.8,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Slow",
        stacks: 1,
        duration: 2,
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.GUNSTINGER]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 0.9,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 5,
        duration: 8,
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
  [ID.DRAGONS_ROAR]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 0.75,
        hits: 1,
        name: "Dragon's Roar — Damage per Bullet",
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.BREACHING_STRIKE_ID_69433]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 2.5,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 500,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
  },
  [ID.LINE_BREAKER]: {
    implemented: true,
    castTimeMs: 1750,
    effects: [
      {
        type: "boon",
        boon: "protection",
        duration: 4,
        stacks: 1,
      },
      {
        type: "boon",
        boon: "aegis",
        duration: 4,
        stacks: 1,
      },
      {
        type: "condition",
        condition: "Weakness",
        stacks: 1,
        duration: 5,
      },
    ],
    quicknessCastTimeMs: 1167,
  },
  [ID.DEFIANT_ROAR]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "boon",
        boon: "resolution",
        duration: 6,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 333,
    adrenalineGain: 10,
    handlerId: "warrior.resource",
  },
  [ID.PATH_TO_VICTORY]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
        hits: 1,
      },
      {
        type: "boon",
        boon: "regeneration",
        duration: 5,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
  },
  [ID.PATH_TO_VICTORY_ID_71932]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
        hits: 1,
      },
      {
        type: "boon",
        boon: "regeneration",
        duration: 5,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: "warrior.resource",
  },
  [ID.PATH_TO_VICTORY_ID_71950]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
        hits: 1,
      },
      {
        type: "boon",
        boon: "regeneration",
        duration: 5,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
  },
  [ID.REVERSE_STRIKE]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 0.8,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.VALIANT_LEAP]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 1.25,
        hits: 1,
      },
      {
        type: "boon",
        boon: "might",
        duration: 8,
        stacks: 5,
      },
      {
        type: "boon",
        boon: "fury",
        duration: 4,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 500,
    adrenalineGain: 5,
    handlerId: "warrior.resource",
  },
  [ID.BALANCED_STRIKE]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 0.7,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.SNAP_PULL]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 6,
        duration: 6,
      },
      {
        type: "control",
        metadata: {
          controlKind: "pull",
        },
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.PATH_TO_VICTORY_ID_72029]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 1.5,
        hits: 1,
      },
      {
        type: "boon",
        boon: "regeneration",
        duration: 5,
        stacks: 1,
      },
    ],
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
  },
  [ID.INSPIRING_WHIRL]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "strike",
        coefficient: 1,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.MAIMING_SPEAR]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 1.1,
        hits: 1,
        name: "Maiming Spear — Initial Strike Damage",
      },
      {
        type: "strike",
        coefficient: 0.75,
        hits: 1,
        name: "Maiming Spear — Aftershock Damage",
      },
      {
        type: "condition",
        condition: "Crippled",
        stacks: 1,
        duration: 3,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.HARRIERS_TOSS]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 5,
        duration: 6,
      },
      {
        type: "strike",
        coefficient: 2.5,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
  },
  [ID.MIGHTY_THROW]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 1.2,
        hits: 1,
        name: "Mighty Throw — Spear Damage",
      },
      {
        type: "strike",
        coefficient: 0.9,
        hits: 1,
        name: "Mighty Throw — Shard Damage",
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.DISRUPTING_THROW]: {
    implemented: true,
    castTimeMs: 500,
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
          duration: 3,
        },
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.SPEARMARSHALS_SUPPORT]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 2.8000000000000003,
        hits: 7,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.HARRIERS_TOSS_ID_73006]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 5,
        duration: 6,
      },
      {
        type: "strike",
        coefficient: 3.5,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
  },
  [ID.SPEAR_SWIPE]: {
    implemented: true,
    castTimeMs: 750,
    effects: [
      {
        type: "control",
        metadata: {
          controlKind: "knockback",
        },
      },
      {
        type: "control",
        metadata: {
          controlKind: "launch",
        },
      },
      {
        type: "strike",
        coefficient: 1.5,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 500,
  },
  [ID.HARRIERS_TOSS_ID_73024]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 2.5,
        hits: 1,
      },
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 5,
        duration: 6,
      },
    ],
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: "warrior.resource",
  },
  [ID.HARRIERS_TOSS_ID_73042]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "condition",
        condition: "Vulnerability",
        stacks: 5,
        duration: 6,
      },
      {
        type: "strike",
        coefficient: 3,
        hits: 1,
      },
    ],
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
  },
  [ID.BLOODTHIRSTER]: {
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
        condition: "Bleeding",
        stacks: 3,
        duration: 6,
      },
    ],
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
    handlerId: "warrior.resource",
  },
  [ID.REND]: {
    implemented: true,
    castTimeMs: 500,
    effects: [
      {
        type: "strike",
        coefficient: 0.5,
        hits: 1,
      },
      {
        type: "strike",
        coefficient: 2.5,
        hits: 1,
        name: "Rend — Follow-Up Damage",
      },
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 6,
        duration: 6,
      },
    ],
    quicknessCastTimeMs: 333,
  },
  [ID.BLOODTHIRSTER_ID_80263]: {
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
        condition: "Bleeding",
        stacks: 3,
        duration: 6,
      },
    ],
    quicknessCastTimeMs: 333,
    adrenalineCost: 10,
    burstTier: 1,
    burst: true,
  },
});
