import {
  CANONICAL_TARGET_CONDITIONS,
  canonicalTargetConditionName,
} from "../../platform/gw2/target-state.js";
import {
  createModifierHooks,
  MODIFIER_TARGET,
} from "../../platform/gw2/modifier-rules.js";
import {
  professionStaticRulesApplied,
} from "../../platform/gw2/attribute-provenance.js";
import { hasTrait } from "../../platform/gw2/trait-state.js";
import {
  THIEF_SKILL_IDS as ID,
  THIEF_TRAIT_IDS as TRAIT,
} from "./data/ids.js";

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
function targetBoonless(context) {
  return context.config?.target?.boonless !== false;
}
function selectedSkill(context, name) {
  const source = context.config?.selectedSkills || [];
  const selected = Array.isArray(source) ? source : Object.values(source);
  return selected.some(value =>
    (typeof value === "string" ? value : value?.name) === name);
}
function meticulousArtifactStrikeFactor(context) {
  const event = context.event || {};
  if (event.skillId === ID.METAL_LEGION_GUITAR) {
    return event.name === "Final Smash" ? 3 / 2.5 : 1.2 / 0.8;
  }
  if (event.skillId === ID.MISTBURN_MORTAR) return 0.6 / 0.5;
  if (event.skillId === ID.CHAK_SHIELD) return 1.8 / 1.5;
  if (event.skillId === ID.SUMMON_KRYPTIS_TURRET_ID_77192) {
    return 3.84 / 2.8;
  }
  if (event.skillId === ID.HOLO_DANCER_DECOY) return 3 / 2;
  return 1;
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
    operation: "multiply",
    factor: 1.2,
    when: context =>
      player(context)
      && hasTrait(context, TRAIT.EXECUTIONER)
      && targetHealthFraction(context) < 0.5,
  },
  {
    id: "thief.ferocious-strikes",
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: "multiply",
    factor: 1.1,
    when: context =>
      player(context)
      && hasTrait(context, TRAIT.FEROCIOUS_STRIKES)
      && targetHealthFraction(context) >= 0.5,
  },
  {
    id: "thief.twin-fangs-critical-damage",
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: "multiply",
    factor: 1.07,
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
    operation: "multiply",
    factor: 1.1,
    when: context =>
      player(context)
      && hasTrait(context, TRAIT.DEADLY_AIM)
      && eventSkill(context)?.weapon === "Pistol",
  },
  {
    id: "thief.larcenous-strike-boonless",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.2,
    when: context =>
      player(context)
      && eventSkill(context)?.name === "Larcenous Strike"
      && targetBoonless(context),
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
    id: "thief.fluid-strikes",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.1,
    when: context =>
      player(context)
      && hasTrait(context, TRAIT.FLUID_STRIKES)
      && Number(context.runtime?.profession?.fluidStrikesUntil || 0)
        > context.time,
  },
  {
    id: "thief.distracting-throw-finisher",
    target: [
      MODIFIER_TARGET.STRIKE_DAMAGE,
      MODIFIER_TARGET.CONDITION_DAMAGE,
    ],
    operation: "damage-additive",
    amount: 0.1,
    when: context =>
      player(context)
      && Number(
        context.runtime?.profession?.distractingThrowBuffUntil || 0,
      ) > context.time,
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
    when: context =>
      player(context)
      && Boolean(eventSkill(context)?.malicious)
      && eventSkill(context)?.name !== "Malicious Ashen Assault",
  },
  {
    id: "thief.vampiric-slash-vulnerable",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.5,
    when: context =>
      player(context)
      && context.event?.name === "Vampiric Slash â€” Life Siphon"
      && targetHasCondition(context, "Vulnerability"),
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
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.1,
    when: context =>
      player(context)
      && Number(context.runtime?.profession?.antiquaryDamageUntil || 0)
        > context.time,
  },
  {
    id: "thief.combat-high-strike",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: context => Math.min(
      10,
      Math.ceil(Math.max(
        0,
        Number(
          context.runtime?.profession?.combatHighExpiresAt || 0,
        ) - context.time,
      ) / 2),
    ) * 0.03,
    when: context =>
      player(context)
      && hasTrait(context, TRAIT.COMBAT_HIGH),
  },
  {
    id: "thief.combat-high-condition",
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: "damage-additive",
    amount: context => Math.min(
      10,
      Math.ceil(Math.max(
        0,
        Number(
          context.runtime?.profession?.combatHighExpiresAt || 0,
        ) - context.time,
      ) / 2),
    ) * 0.02,
    when: context =>
      player(context)
      && hasTrait(context, TRAIT.COMBAT_HIGH),
  },
  {
    id: "thief.kryptis-turret-damage",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.15,
    when: context =>
      player(context)
      && Number(context.runtime?.profession?.kryptisDamageUntil || 0)
        > context.time,
  },
  {
    id: "thief.meticulous-custodian-artifact-strike",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: meticulousArtifactStrikeFactor,
    when: context =>
      player(context)
      && hasTrait(context, TRAIT.METICULOUS_CUSTODIAN)
      && [
        ID.METAL_LEGION_GUITAR,
        ID.MISTBURN_MORTAR,
        ID.CHAK_SHIELD,
        ID.SUMMON_KRYPTIS_TURRET_ID_77192,
        ID.HOLO_DANCER_DECOY,
      ].includes(
        Number(context.event?.skillId),
      ),
  },
  {
    id: "thief.meticulous-custodian-mortar-burning",
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: "multiply",
    factor: 2 / 1.5,
    when: context =>
      hasTrait(context, TRAIT.METICULOUS_CUSTODIAN)
      && context.event?.skillId === ID.MISTBURN_MORTAR
      && context.event?.condition === "Burning"
      && context.event?.triggeredBy == null,
  },
  {
    id: "thief.meticulous-custodian-sun-crystal-burning",
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: "multiply",
    factor: 5 / 4,
    when: context =>
      hasTrait(context, TRAIT.METICULOUS_CUSTODIAN)
      && context.event?.skillId === ID.ZEPHYRITE_SUN_CRYSTAL
      && context.event?.condition === "Burning",
  },
  {
    id: "thief.potent-poison-damage",
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: "multiply",
    factor: 1.33,
    when: context =>
      player(context)
      && context.event?.condition === "Poisoned"
      && hasTrait(context, TRAIT.POTENT_POISON),
  },
  {
    id: "thief.deadly-ambush-bleeding",
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: "multiply",
    factor: 1.25,
    when: context =>
      player(context)
      && context.event?.condition === "Bleeding"
      && hasTrait(context, TRAIT.DEADLY_AMBUSH),
  },
  {
    id: "thief.potent-poison-duration",
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: "multiply",
    factor: 1.33,
    when: context =>
      context.event?.condition === "Poisoned"
      && hasTrait(context, TRAIT.POTENT_POISON),
  },
  {
    id: "thief.keen-observer",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: 0.15,
    when: context =>
      player(context)
      && hasTrait(context, TRAIT.KEEN_OBSERVER),
  },
  {
    id: "thief.hidden-killer",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: 1,
    when: context => {
      const state = context.runtime?.profession || {};
      return player(context)
        && hasTrait(context, TRAIT.HIDDEN_KILLER)
        && (
          Number(state.stealthUntil || 0) > context.time
          || Number(state.revealedUntil || 0) + 1 > context.time
        );
    },
  },
];

function modifyThiefAttributes(context, attributes) {
  const result = { ...attributes };
  const state = context.runtime?.profession || {};
  const staticRulesApplied = professionStaticRulesApplied(context.config);
  if (selectedSkill(context, "Assassin's Signet")) {
    const passiveDisabled =
      Number(state.assassinsSignetPassiveDisabledUntil || 0) > context.time;
    if (staticRulesApplied && passiveDisabled) result.power -= 180;
    if (!staticRulesApplied && !passiveDisabled) result.power += 180;
    if (Number(state.assassinsSignetActiveUntil || 0) > context.time) {
      result.power += 540;
    }
  }
  if (
    hasTrait(context, TRAIT.REVEALED_TRAINING)
    && Number(state.revealedUntil || 0) > context.time
  ) {
    if (!staticRulesApplied) result.power += 80;
    result.power += 120;
  }
  return result;
}

export const thiefAttributeRules = Object.freeze({
  modifyAttributes: modifyThiefAttributes,
  ...createModifierHooks({ rules }),
});
