import {
  createModifierHooks,
  MODIFIER_TARGET,
} from "../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../platform/gw2/trait-state.js";
import { REVENANT_TRAIT_IDS as TRAIT } from "./data/ids.js";

function player(context) {
  return context.event?.actorType !== "summon";
}
function releasePotential(context) {
  return String(context.event?.skillName || "").startsWith(
    "Release Potential:",
  );
}
const rules = [
  {
    id: "revenant.ferocious-aggression",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.07,
    when: context =>
      player(context)
      && hasTrait(context, TRAIT.FEROCIOUS_AGGRESSION)
      && Boolean(context.config?.boons?.fury),
  },
  {
    id: "revenant.rising-tide",
    target: [
      MODIFIER_TARGET.STRIKE_DAMAGE,
      MODIFIER_TARGET.CONDITION_DAMAGE,
    ],
    operation: "damage-additive",
    amount: 0.1,
    when: context =>
      player(context)
      && hasTrait(context, TRAIT.RISING_TIDE)
      && Number(context.config?.playerHealthFraction ?? 1) >= 0.9,
  },
  {
    id: "revenant.release-affinity",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: context =>
      1 + Math.min(
        5,
        Number(context.runtime?.profession?.affinity || 0),
      ) * 0.1,
    when: releasePotential,
  },
];
const modifierHooks = createModifierHooks({ rules });

function modifyCriticalChance(context, chance) {
  if (
    hasTrait(context, TRAIT.ROILING_MISTS)
    && context.config?.boons?.fury
  ) return chance + 0.15;
  return chance;
}

export const revenantAttributeRules = Object.freeze({
  modifyAttributes: (_context, attributes) => ({ ...attributes }),
  ...modifierHooks,
  modifyCriticalChance,
});

