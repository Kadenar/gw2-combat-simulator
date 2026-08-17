import type { BalanceProfile } from "../../../../platform/engine/types.js";
import {
  THIEF_SKILL_IDS as ID,
  THIEF_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";

export const SPECTER_BALANCE_PROFILE_IDS = Object.freeze({
  resources: "thief.specter.resources",
  enterShadowShroud: "thief.specter.enter-shadow-shroud",
  dawnsReposeBarrier: "thief.specter.dawns-repose-barrier",
  amplifiedSiphoning: TRAIT.AMPLIFIED_SIPHONING,
  shadeStep: TRAIT.SHADESTEP,
  larcenousTorment: TRAIT.LARCENOUS_TORMENT,
  darkSentry: TRAIT.DARK_SENTRY,
  secondOpinion: TRAIT.SECOND_OPINION,
  strengthOfShadows: TRAIT.STRENGTH_OF_SHADOWS,
});

const trait = (
  id: number,
  name: string,
  fields: Readonly<Record<string, unknown>>,
): BalanceProfile => ({
  id,
  name,
  profileKind: "trait",
  categories: ["Trait"],
  skillFamily: "Trait",
  effects: [],
  ...fields,
});

export const SPECTER_BALANCE_PROFILES: readonly BalanceProfile[] =
  Object.freeze([
    {
      id: SPECTER_BALANCE_PROFILE_IDS.resources,
      name: "Specter Shadow Force",
      profileKind: "mechanic",
      maximumStacks: 100,
      resourceGain: 1,
      lifeForceGain: 25,
      lifeForceDrain: 0.02,
      attributeConversion: 0.69,
      effects: [],
    },
    {
      id: SPECTER_BALANCE_PROFILE_IDS.enterShadowShroud,
      name: "Enter Shadow Shroud - Barrier",
      profileKind: "skill-variant",
      parentId: ID.ENTER_SHADOW_SHROUD,
      maximumTargets: 1,
      effects: [{ type: "buff", kind: "barrier", stacks: 1, duration: 5 }],
    },
    {
      id: SPECTER_BALANCE_PROFILE_IDS.dawnsReposeBarrier,
      name: "Dawn's Repose - Barrier",
      profileKind: "skill-variant",
      parentId: ID.DAWNS_REPOSE,
      maximumTargets: 4,
      effects: [{ type: "buff", kind: "barrier", stacks: 1, duration: 5 }],
    },
    trait(
      SPECTER_BALANCE_PROFILE_IDS.amplifiedSiphoning,
      "Amplified Siphoning",
      { resourceGain: 27.5 },
    ),
    trait(SPECTER_BALANCE_PROFILE_IDS.shadeStep, "Shadestep", {
      effects: [
        { type: "boon", boon: "alacrity", stacks: 1, duration: 5 },
        { type: "boon", boon: "protection", stacks: 1, duration: 5 },
        { type: "boon", boon: "aegis", stacks: 1, duration: 4 },
      ],
    }),
    trait(SPECTER_BALANCE_PROFILE_IDS.larcenousTorment, "Larcenous Torment", {
      resourceGain: 0.5,
      effects: [{ type: "strike", coefficient: 0.005, hits: 1 }],
    }),
    trait(SPECTER_BALANCE_PROFILE_IDS.darkSentry, "Dark Sentry", {
      internalCooldown: 1,
      effects: [
        {
          type: "buff",
          kind: "rot-wallow-venom",
          stacks: 1,
          duration: 10,
        },
        { type: "condition", condition: "Torment", stacks: 1, duration: 2 },
      ],
    }),
    trait(SPECTER_BALANCE_PROFILE_IDS.secondOpinion, "Second Opinion", {
      attributeBonus: 90,
      attributePerStack: 90,
      attributeConversion: 0.07,
    }),
    trait(
      SPECTER_BALANCE_PROFILE_IDS.strengthOfShadows,
      "Strength of Shadows",
      {
        attributeConversion: 0.13,
      },
    ),
  ]);
