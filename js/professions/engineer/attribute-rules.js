import {
  CANONICAL_TARGET_CONDITIONS,
} from "../../platform/gw2/target-state.js";
import {
  createModifierHooks,
  MODIFIER_TARGET,
} from "../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../platform/gw2/trait-state.js";
import { ENGINEER_TRAIT_IDS as TRAIT } from "./data/ids.js";

function targetConditionCount(context) {
  return CANONICAL_TARGET_CONDITIONS.filter(condition =>
    context.query?.targetHasCondition(
      condition,
      context.time,
      context.runtime,
    )).length;
}

function vulnerability(context) {
  return Number(
    context.query?.targetConditionStacks(
      "Vulnerability",
      context.time,
      context.runtime,
    ) || 0,
  );
}

function playerStrike(context) {
  return context.event?.actorType !== "summon";
}

const engineerModifierRules = [
  {
    id: "engineer.glass-cannon",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.1,
    when: context =>
      playerStrike(context)
      && hasTrait(context, TRAIT.GLASS_CANNON)
      && Number(context.config?.playerHealthFraction ?? 1) > 0.75,
  },
  {
    id: "engineer.shaped-charge",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: context => Math.min(25, vulnerability(context)) * 0.005,
    when: context =>
      playerStrike(context)
      && hasTrait(context, TRAIT.SHAPED_CHARGE),
  },
  {
    id: "engineer.modified-ammunition",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: context => targetConditionCount(context) * 0.02,
    when: context =>
      playerStrike(context)
      && hasTrait(context, TRAIT.MODIFIED_AMMUNITION),
  },
  {
    id: "engineer.excessive-energy",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.1,
    when: context =>
      playerStrike(context)
      && hasTrait(context, TRAIT.EXCESSIVE_ENERGY)
      && Boolean(context.config?.boons?.vigor),
  },
  {
    id: "engineer.lasers-edge",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: context => {
      const state = context.runtime?.profession || {};
      const maximum = Math.max(1, Number(state.maximumHeat || 100));
      const cap = hasTrait(
        context,
        TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT,
      ) ? 0.225 : 0.15;
      return Math.min(1, Number(state.heat || 0) / maximum) * cap;
    },
    when: context =>
      playerStrike(context)
      && hasTrait(context, TRAIT.LASERS_EDGE)
      && Boolean(context.runtime?.profession?.photonForgeActive),
  },
];

const engineerModifierHooks = createModifierHooks({
  rules: engineerModifierRules,
});

function modifyEngineerAttributes(_context, attributes) {
  return { ...attributes };
}

export const engineerAttributeRules = Object.freeze({
  modifyAttributes: modifyEngineerAttributes,
  ...engineerModifierHooks,
});

