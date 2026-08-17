import type { BalanceProfile } from "../../../../platform/engine/types.js";
import { WARRIOR_TRAIT_IDS as TRAIT } from "../../data/ids.js";

export const SPELLBREAKER_BALANCE_PROFILE_IDS = Object.freeze({
  resources: "warrior.spellbreaker.resources",
  fullCounter: "warrior.spellbreaker.full-counter-window",
  attackersInsight: TRAIT.ATTACKERS_INSIGHT,
  magebaneTether: TRAIT.MAGEBANE_TETHER,
  noEscape: TRAIT.NO_ESCAPE,
  pureStrike: TRAIT.PURE_STRIKE,
  sunAndMoonStyle: TRAIT.SUN_AND_MOON_STYLE,
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

export const SPELLBREAKER_BALANCE_PROFILES: readonly BalanceProfile[] =
  Object.freeze([
    {
      id: SPELLBREAKER_BALANCE_PROFILE_IDS.resources,
      name: "Spellbreaker Adrenaline",
      profileKind: "mechanic",
      maximumStacks: 20,
      effects: [],
    },
    {
      id: SPELLBREAKER_BALANCE_PROFILE_IDS.fullCounter,
      name: "Full Counter Window",
      profileKind: "mechanic",
      effects: [{ type: "buff", kind: "full-counter", stacks: 1, duration: 1 }],
    },
    trait(
      SPELLBREAKER_BALANCE_PROFILE_IDS.attackersInsight,
      "Attacker's Insight",
      {
        maximumStacks: 5,
        attributePerStack: 50,
        effects: [
          { type: "buff", kind: "attackers-insight", stacks: 1, duration: 15 },
        ],
      },
    ),
    trait(SPELLBREAKER_BALANCE_PROFILE_IDS.magebaneTether, "Magebane Tether", {
      cooldown: 12,
      damageMultiplier: 1.15,
      effects: [
        { type: "buff", kind: "magebane-tether", stacks: 1, duration: 8 },
      ],
    }),
    trait(SPELLBREAKER_BALANCE_PROFILE_IDS.noEscape, "No Escape", {
      effects: [
        { type: "condition", condition: "Immobilized", stacks: 1, duration: 1 },
      ],
    }),
    trait(SPELLBREAKER_BALANCE_PROFILE_IDS.pureStrike, "Pure Strike", {
      damageMultiplier: 1.05,
      coefficientMultiplier: 1.1,
    }),
    trait(
      SPELLBREAKER_BALANCE_PROFILE_IDS.sunAndMoonStyle,
      "Sun and Moon Style",
      {
        damageMultiplier: 1.1,
      },
    ),
  ]);
