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

function activeBoonStacks(context, kind, maximum = 25) {
  const permanent = context.config?.boons?.[kind];
  const base = permanent === true ? 1 : Number(permanent || 0);
  const boons = context.runtime?.boons ?? context.state?.boons;
  const dynamic = (boons?.get(kind) || [])
    .filter(application =>
      application.at <= context.time
      && application.expiresAt > context.time)
    .reduce(
      (sum, application) => sum + Number(application.stacks || 1),
      0,
    );
  return Math.max(0, Math.min(maximum, base + dynamic));
}

function activeEngineerState(context, field) {
  const state =
    context.runtime?.profession
    ?? context.state?.profession;
  return Number(state?.[field] || 0) > context.time;
}

const EVOLVE_ATTRIBUTES = Object.freeze([
  "power",
  "precision",
  "toughness",
  "vitality",
  "ferocity",
  "conditionDamage",
  "expertise",
  "concentration",
  "healingPower",
]);

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
    amount: context => targetConditionCount(context) * 0.01,
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
  {
    id: "engineer.willing-host",
    target: [
      MODIFIER_TARGET.STRIKE_DAMAGE,
      MODIFIER_TARGET.CONDITION_DAMAGE,
    ],
    operation: "damage-additive",
    amount: 0.05,
    when: context =>
      context.event?.actorType !== "summon"
      && hasTrait(context, TRAIT.WILLING_HOST)
      && activeEngineerState(context, "willingHostUntil"),
  },
  {
    id: "engineer.plasmatic-state",
    target: [
      MODIFIER_TARGET.STRIKE_DAMAGE,
      MODIFIER_TARGET.CONDITION_DAMAGE,
    ],
    operation: "damage-additive",
    amount: 0.07,
    when: context =>
      context.event?.actorType !== "summon"
      && activeEngineerState(context, "plasmaticStateUntil"),
  },
  {
    id: "engineer.flame-jet-burning-target",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.1,
    when: context =>
      context.event?.skillName === "Flame Jet"
      && Boolean(context.query?.targetHasCondition(
        "Burning",
        context.time,
        context.runtime,
      )),
  },
  {
    id: "engineer.thermal-vision-damage",
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: "damage-additive",
    amount: 0.05,
    when: context =>
      hasTrait(context, TRAIT.THERMAL_VISION)
      && Number(
        context.runtime?.profession?.traitProcReadyAt
          ?.thermalVisionUntil || 0,
      ) > context.time,
  },
  {
    id: "engineer.serrated-steel-duration",
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: "add",
    amount: 0.33,
    when: context =>
      context.condition === "Bleeding"
      && hasTrait(context, TRAIT.SERRATED_STEEL),
  },
  {
    id: "engineer.incendiary-powder-duration",
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: "add",
    amount: 0.33,
    when: context =>
      context.condition === "Burning"
      && hasTrait(context, TRAIT.INCENDIARY_POWDER),
  },
  {
    id: "engineer.carbolic-composition-duration",
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: "add",
    amount: 0.33,
    when: context =>
      context.condition === "Poisoned"
      && hasTrait(context, TRAIT.CARBOLIC_COMPOSITION),
  },
  {
    id: "engineer.chemical-rounds-duration",
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: "add",
    amount: 0.33,
    when: context => {
      if (!hasTrait(context, TRAIT.CHEMICAL_ROUNDS)) return false;
      const skill = context.profession?.catalog?.skillsById?.get(
        context.event?.skillId,
      );
      return (
        context.event?.skillWeapon === "Pistol"
        || skill?.weapon === "Pistol"
      );
    },
  },
  {
    id: "engineer.hematic-focus",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: 0.15,
    when: context =>
      hasTrait(context, TRAIT.HEMATIC_FOCUS)
      && activeBoonStacks(context, "fury", 1) > 0,
  },
];

const engineerModifierHooks = createModifierHooks({
  rules: engineerModifierRules,
});

function modifyEngineerAttributes(context, attributes) {
  const modified = { ...attributes };
  const buildAttributesApplied =
    context.config?.engineerBuildAttributesApplied === true;
  if (
    hasTrait(context, TRAIT.CHEMICAL_ROUNDS)
    && !buildAttributesApplied
  ) {
    modified.conditionDamage = Number(modified.conditionDamage || 0) + 120;
  }
  if (
    hasTrait(context, TRAIT.THERMAL_VISION)
    && !buildAttributesApplied
  ) {
    modified.expertise = Number(modified.expertise || 0) + 150;
  }
  if (activeEngineerState(context, "evolvedUntil")) {
    for (const attribute of EVOLVE_ATTRIBUTES) {
      modified[attribute] = Number(modified[attribute] || 0) * 1.1;
    }
  }
  if (activeEngineerState(context, "titanicUntil")) {
    const improvedMight = activeBoonStacks(context, "might") * 5;
    modified.power += improvedMight;
    modified.conditionDamage += improvedMight;
  }
  return modified;
}

export const engineerAttributeRules = Object.freeze({
  modifyAttributes: modifyEngineerAttributes,
  ...engineerModifierHooks,
});
