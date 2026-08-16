import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";

// All numeric values here come from wiki/in-game data; changing them should be a deliberate balance update, not a code fix.
export const HARBINGER_MECHANICS = Object.freeze({
  cascadingCorruptionCoefficient: 4.5,
  traitProcs: Object.freeze({
    [TRAIT.SEPTIC_CORRUPTION]: Object.freeze({
      name: "Septic Corruption",
      traitId: TRAIT.SEPTIC_CORRUPTION,
      condition: "Poisoned",
      duration: 3,
    }),
  }),
  elixirs: Object.freeze({
    coefficientBySkillId: Object.freeze({
      [ID.ELIXIR_OF_PROMISE]: 0.8,
      [ID.ELIXIR_OF_RISK]: 2,
      [ID.ELIXIR_OF_BLISS]: 0.8,
      [ID.ELIXIR_OF_IGNORANCE]: 0.8,
      [ID.ELIXIR_OF_ANGUISH]: 1,
      [ID.ELIXIR_OF_AMBITION]: 1.5,
    }),
    // Empowered state doubles both the damage coefficient and the condition duration; the two multipliers are independent and must stay in sync with the game.
    empoweredCoefficientMultiplier: 2,
    durationMultiplier: 2,
    conditionBySkillId: Object.freeze({
      [ID.ELIXIR_OF_PROMISE]: Object.freeze(["Poisoned", 3, 5]),
      [ID.ELIXIR_OF_RISK]: Object.freeze(["Torment", 3, 5]),
    }),
    // Elixir of Ambition applies every damaging condition type; the order here matches the wiki's listed order.
    ambitionConditions: Object.freeze([
      "Bleeding",
      "Burning",
      "Confusion",
      "Poisoned",
      "Torment",
    ]),
    ambitionConditionStacks: 3,
    ambitionConditionDuration: 5,
  }),
  blightSkills: Object.freeze({
    [ID.DEVOURING_CUT]: Object.freeze({
      coefficient: 1,
      empoweredCoefficient: 2,
      empoweredCondition: Object.freeze(["Torment", 5, 5]),
    }),
    [ID.VORACIOUS_ARC]: Object.freeze({
      coefficient: 1.4,
      empoweredCoefficient: 2.8,
      empoweredCondition: Object.freeze(["Torment", 5, 7]),
    }),
  }),
});
