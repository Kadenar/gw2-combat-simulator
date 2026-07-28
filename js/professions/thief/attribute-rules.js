import {
  CANONICAL_TARGET_CONDITIONS,
  canonicalTargetConditionName,
} from "../../platform/gw2/target-state.js";
import {
  createModifierHooks,
  MODIFIER_TARGET,
} from "../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../platform/gw2/trait-state.js";
import { THIEF_TRAIT_IDS as TRAIT } from "./data/ids.js";

function eventSkill(context) {
  return context.profession?.catalog?.skillsById?.get(
    context.event?.skillId ?? context.skillId,
  );
}
function player(context) {
  return context.event?.actorType !== "summon";
}
function targetHealthFraction(context) {
  const maximum = Number(context.config?.target?.health || 0);
  if (!(maximum > 0)) return 1;
  const damage =
    Number(context.runtime?.totals?.strike || 0)
    + Number(context.runtime?.totals?.condition || 0);
  return Math.max(0, 1 - damage / maximum);
}
function targetConditionCount(context) {
  const names = new Set([
    ...CANONICAL_TARGET_CONDITIONS,
    ...Object.keys(context.config?.target?.conditions || {})
      .map(canonicalTargetConditionName),
    ...[...(context.runtime?.conditionState?.keys?.() || [])]
      .map(canonicalTargetConditionName),
  ]);
  return [...names].filter(condition =>
    context.query?.targetHasCondition(
      condition,
      context.time,
      context.runtime,
    )).length;
}
function targetHasCondition(context, condition) {
  return Boolean(context.query?.targetHasCondition(
    condition,
    context.time,
    context.runtime,
  ));
}
function positional(context) {
  const target = context.config?.target || {};
  return Boolean(target.behind || target.flanking || target.defiant);
}
function activeBoonCount(context) {
  return Object.values(context.config?.boons || {}).filter(value =>
    typeof value === "number" ? value > 0 : Boolean(value)).length;
}
function marked(context) {
  return Boolean(context.runtime?.profession?.markedTargetId);
}

const rules = [
  {
    id: "thief.exposed-weakness",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: context => targetConditionCount(context) * 0.02,
    when: context => player(context) && hasTrait(
      context,
      TRAIT.EXPOSED_WEAKNESS,
    ),
  },
  {
    id: "thief.executioner",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.2,
    when: context =>
      player(context)
      && hasTrait(context, TRAIT.EXECUTIONER)
      && targetHealthFraction(context) < 0.5,
  },
  {
    id: "thief.ferocious-strikes",
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: "add",
    amount: 0.1,
    when: context =>
      player(context)
      && hasTrait(context, TRAIT.FEROCIOUS_STRIKES)
      && targetHealthFraction(context) >= 0.5,
  },
  {
    id: "thief.twin-fangs-critical-damage",
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: "add",
    amount: context =>
      Number(context.config?.playerHealthFraction ?? 1) >= 0.9 ? 0.14 : 0.07,
    when: context => player(context) && hasTrait(context, TRAIT.TWIN_FANGS),
  },
  {
    id: "thief.twin-fangs-critical-chance",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: 0.07,
    when: context =>
      player(context)
      && hasTrait(context, TRAIT.TWIN_FANGS)
      && positional(context),
  },
  {
    id: "thief.deadly-aim",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.1,
    when: context =>
      player(context)
      && hasTrait(context, TRAIT.DEADLY_AIM)
      && eventSkill(context)?.weapon === "Pistol",
  },
  {
    id: "thief.iron-sight",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.1,
    when: context =>
      player(context)
      && hasTrait(context, TRAIT.IRON_SIGHT)
      && marked(context),
  },
  {
    id: "thief.premeditation",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: context => activeBoonCount(context) * 0.01,
    when: context => player(context) && hasTrait(
      context,
      TRAIT.PREMEDITATION,
    ),
  },
  {
    id: "thief.lead-attacks",
    target: [
      MODIFIER_TARGET.STRIKE_DAMAGE,
      MODIFIER_TARGET.CONDITION_DAMAGE,
    ],
    operation: "damage-additive",
    amount: context =>
      Math.min(
        15,
        Number(context.runtime?.profession?.leadAttacksStacks || 0),
      ) * 0.01,
    when: context => player(context) && hasTrait(context, TRAIT.LEAD_ATTACKS),
  },
  {
    id: "thief.weakening-strikes",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.1,
    when: context =>
      player(context)
      && hasTrait(context, TRAIT.WEAKENING_STRIKES)
      && targetHasCondition(context, "Weakness"),
  },
  {
    id: "thief.havoc-specialist",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: context => {
      const state = context.runtime?.profession || {};
      const maximum = Math.max(1, Number(state.maximumEndurance || 100));
      return (1 - Number(state.endurance || 0) / maximum) * 0.15;
    },
    when: context =>
      player(context) && hasTrait(context, TRAIT.HAVOC_SPECIALIST),
  },
  {
    id: "thief.bounding-dodger",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.1,
    when: context =>
      player(context)
      && hasTrait(context, TRAIT.BOUNDING_DODGER)
      && Number(context.runtime?.profession?.boundingDamageUntil || 0)
        > context.time,
  },
  {
    id: "thief.backstab-position",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 2,
    when: context =>
      player(context)
      && ["Backstab", "Malicious Backstab"].includes(
        eventSkill(context)?.name,
      )
      && Boolean(
        context.config?.target?.behind || context.config?.target?.defiant,
      ),
  },
  {
    id: "thief.malicious-stealth-attack",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: context =>
      Math.max(0, Number(context.runtime?.profession?.malice || 0)) * 0.15,
    when: context => player(context) && Boolean(eventSkill(context)?.malicious),
  },
  {
    id: "thief.strength-of-shadows",
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: "damage-additive",
    amount: 0.2,
    when: context =>
      player(context)
      && hasTrait(context, TRAIT.STRENGTH_OF_SHADOWS)
      && context.event?.condition === "Torment",
  },
  {
    id: "thief.antiquary-artifact-momentum",
    target: [
      MODIFIER_TARGET.STRIKE_DAMAGE,
      MODIFIER_TARGET.CONDITION_DAMAGE,
    ],
    operation: "damage-additive",
    amount: 0.1,
    when: context =>
      player(context)
      && Number(context.runtime?.profession?.antiquaryDamageUntil || 0)
        > context.time,
  },
];

export const thiefAttributeRules = Object.freeze({
  modifyAttributes: (_context, attributes) => ({ ...attributes }),
  ...createModifierHooks({ rules }),
});
