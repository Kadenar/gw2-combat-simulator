import {
  createModifierHooks,
  MODIFIER_TARGET,
} from "../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";
import { RANGER_TRAIT_IDS as TRAIT } from "../data/ids.js";
import { rangerCoreCastAvailability } from "./availability.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
} from "../../../platform/gw2/types.js";

function playerEvent(context: Gw2ModifierContext): boolean {
  return context.event?.actorType !== "summon";
}

function petEvent(context: Gw2ModifierContext): boolean {
  return (
    context.event?.actorType === "summon" &&
    context.event?.source === "ranger-pet"
  );
}

function positional(context: Gw2ModifierContext): boolean {
  return Boolean(
    context.config?.target?.behind ||
    context.config?.target?.flanking ||
    context.config?.target?.defiant,
  );
}

function targetImpaired(context: Gw2ModifierContext): boolean {
  if (context.config?.target?.defiant) return true;
  return ["Chilled", "Crippled", "Immobilized", "Taunt", "Fear", "Slow"].some(
    (condition) =>
      Boolean(
        context.query?.targetHasCondition(
          condition,
          context.time,
          context.runtime,
        ),
      ),
  );
}

export const rangerCoreModifierRules: readonly Gw2ModifierRule[] =
  Object.freeze([
    {
      id: "ranger.hunters-tactics-damage",
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: "damage-additive",
      amount: 0.1,
      when: (context) =>
        playerEvent(context) &&
        positional(context) &&
        hasTrait(context, TRAIT.HUNTERS_TACTICS),
    },
    {
      id: "ranger.hunters-tactics-critical-chance",
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: "add",
      amount: 0.1,
      when: (context) =>
        playerEvent(context) &&
        positional(context) &&
        hasTrait(context, TRAIT.HUNTERS_TACTICS),
    },
    {
      id: "ranger.farsighted",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: 0.1,
      when: (context) =>
        playerEvent(context) && hasTrait(context, TRAIT.FARSIGHTED),
    },
    {
      id: "ranger.predators-onslaught-player",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: 0.1,
      when: (context) =>
        playerEvent(context) &&
        targetImpaired(context) &&
        hasTrait(context, TRAIT.PREDATORS_ONSLAUGHT),
    },
    {
      id: "ranger.predators-onslaught-pet",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: 0.1,
      when: (context) =>
        petEvent(context) &&
        targetImpaired(context) &&
        hasTrait(context, TRAIT.PREDATORS_ONSLAUGHT),
    },
    {
      id: "ranger.hidden-barbs",
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: "multiply",
      factor: 1.2,
      when: (context) =>
        context.condition === "Bleeding" &&
        hasTrait(context, TRAIT.HIDDEN_BARBS),
    },
    {
      id: "ranger.poison-master",
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: "multiply",
      factor: 1.2,
      when: (context) =>
        context.condition === "Poisoned" &&
        hasTrait(context, TRAIT.POISON_MASTER),
    },
    {
      id: "ranger.survival-instincts",
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: "damage-additive",
      amount: 0.1,
      when: (context) =>
        playerEvent(context) && hasTrait(context, TRAIT.SURVIVAL_INSTINCTS),
    },
    {
      id: "ranger.pets-prowess",
      target: MODIFIER_TARGET.CRITICAL_DAMAGE,
      operation: "multiply",
      factor: 1.3,
      when: (context) =>
        petEvent(context) && hasTrait(context, TRAIT.PETS_PROWESS),
    },
  ]);

export function compileRangerModifierRules(rules: readonly Gw2ModifierRule[]) {
  return createModifierHooks({ rules });
}

export const rangerCoreAttributeRules = Object.freeze({
  modifierRules: rangerCoreModifierRules,
  compileModifierRules: compileRangerModifierRules,
});

export const rangerCoreCastRules = Object.freeze({
  availability: {
    id: "ranger.core-availability",
    order: 10,
    handler: rangerCoreCastAvailability,
  },
});
