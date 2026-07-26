import { MESMER_TRAIT_IDS as TRAIT } from "./data/ids.js";
import {
  createModifierHooks,
  MODIFIER_TARGET,
} from "../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../platform/gw2/trait-state.js";

const EPSILON = 0.0001;

function illusionSource(context) {
  return (
    context.event?.source === "Clone"
    || context.event?.source === "Phantasm"
  );
}

function timedStacks(context, kind, duration, maximum) {
  return context.timeline?.timedStacks(kind, context.time, duration, maximum) || 0;
}

function timedActive(context, kind) {
  return Boolean(context.timeline?.timedActive(kind, context.time));
}

function instrumentsAt(context) {
  return (context.events || []).filter(event =>
    event.type === "mesmer.instrument"
    && event.at <= context.time + EPSILON
    && event.expiresAt > context.time);
}

function thornsStacksAt(time) {
  if (time < 3 - EPSILON) return 0;
  return Math.min(10, Math.floor((time - 3 + EPSILON) / 5) + 1);
}

export function applyMesmerAttributes(context, attributes) {
  const instruments = instrumentsAt(context);
  const fortissimo =
    hasTrait(context, TRAIT.FORTISSIMO) && instruments.length
      ? 1 + instruments.length * 0.04
      : 1;
  const thorns =
    context.config.relic === "Thorns"
      ? thornsStacksAt(context.time) * 30
      : 0;
  const midnight =
    context.config.selectedSkills?.includes("Signet of Midnight")
    && context.timeline?.skillOnCooldownAt(10234, context.time)
      ? 180
      : 0;
  const domination =
    context.config.selectedSkills?.includes("Signet of Domination")
    && context.timeline?.skillOnCooldownAt(10232, context.time)
      ? 180
      : 0;
  return {
    ...attributes,
    power: Number(attributes.power || 0) * fortissimo,
    precision: Number(attributes.precision || 0) * fortissimo,
    ferocity:
      (Number(attributes.ferocity || 0)
        + timedStacks(context, "fencer", 6, 10) * 15)
      * fortissimo,
    conditionDamage:
      (Number(attributes.conditionDamage || 0) + thorns - domination)
      * fortissimo,
    expertise: (Number(attributes.expertise || 0) - midnight) * fortissimo,
  };
}

function hasLute(context) {
  return instrumentsAt(context)
    .some(event => event.instrument === "Lute");
}

function superiorityComplexFactor(context) {
  const targetHealth = Number(context.config.target?.health || 0);
  const totalDamage =
    Number(context.runtime?.totals?.strike || 0)
    + Number(context.runtime?.totals?.condition || 0);
  return (
    context.config.target?.disabled
    || (targetHealth > 0 && totalDamage >= targetHealth * 0.5)
  ) ? 1.25 : 1.15;
}

export const mesmerModifierRules = Object.freeze([
  {
    id: "mesmer.illusion-config-critical-chance",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: context =>
      -Number(context.config.stats?.criticalChanceBonus || 0) / 100,
    when: illusionSource,
  },
  {
    id: "mesmer.illusion-sigil-critical-chance",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: context =>
      -Number(
        context.timeline?.activeSigilSetAt(context.time)
          ?.criticalChanceBonus || 0,
      ) / 100,
    when: illusionSource,
  },
  {
    id: "mesmer.illusion-fury-critical-chance",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: -0.25,
    when: context =>
      illusionSource(context)
      && context.timeline?.furyActiveAt(context.time),
  },
  {
    id: "mesmer.mistburn-critical-chance",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: 0.1,
    when: context =>
      !illusionSource(context)
      && context.config.relic === "Mistburn"
      && context.timeline?.mightStacksAt(context.time) >= 10,
  },
  {
    id: "mesmer.flow-of-time-critical-chance",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: 0.15,
    when: context =>
      hasTrait(context, TRAIT.FLOW_OF_TIME)
      && context.config.boons?.alacrity
      && ["Player", "Clone", "Phantasm"].includes(context.event?.source),
  },
  {
    id: "mesmer.quiet-intensity-critical-chance",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: 0.15,
    when: context =>
      !illusionSource(context)
      && hasTrait(context, TRAIT.QUIET_INTENSITY)
      && context.timeline?.furyActiveAt(context.time),
  },
  {
    id: "mesmer.phantasmal-fury-critical-chance",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: context =>
      context.config.specialization === "Virtuoso" ? 0.4 : 0.25,
    when: context =>
      context.event?.source === "Phantasm"
      && hasTrait(context, TRAIT.PHANTASMAL_FURY),
  },
  {
    id: "mesmer.superiority-complex",
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: "multiply",
    factor: superiorityComplexFactor,
    when: context =>
      hasTrait(context, TRAIT.SUPERIORITY_COMPLEX)
      && context.event?.source !== "Phantasm",
  },
  {
    id: "mesmer.danger-time",
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: "multiply",
    factor: 1.05,
    when: context =>
      hasTrait(context, TRAIT.DANGER_TIME)
      && ["Player", "Clone"].includes(context.event?.source)
      && timedActive(context, "danger-time"),
  },
  {
    id: "mesmer.nomads-endurance",
    target: [
      MODIFIER_TARGET.STRIKE_DAMAGE,
      MODIFIER_TARGET.CONDITION_DAMAGE,
    ],
    operation: "damage-additive",
    amount: (_context, target) =>
      target === MODIFIER_TARGET.STRIKE_DAMAGE ? 0.1 : 0.05,
    when: context =>
      hasTrait(context, TRAIT.NOMADS_ENDURANCE)
      && context.timeline?.vigorActiveAt(context.time),
  },
  {
    id: "mesmer.compounding-power",
    target: [
      MODIFIER_TARGET.STRIKE_DAMAGE,
      MODIFIER_TARGET.CONDITION_DAMAGE,
    ],
    operation: "damage-additive",
    amount: context =>
      timedStacks(context, "compounding", 8, 5) * 0.01,
    when: context => !illusionSource(context),
  },
  {
    id: "mesmer.phantom-pain",
    target: [
      MODIFIER_TARGET.STRIKE_DAMAGE,
      MODIFIER_TARGET.CONDITION_DAMAGE,
    ],
    operation: "damage-additive",
    amount: (context, target) =>
      timedStacks(context, "phantom-pain", 10, 4)
      * (target === MODIFIER_TARGET.CONDITION_DAMAGE ? 0.05 : 0.0625),
  },
  {
    id: "mesmer.deadly-blades",
    target: [
      MODIFIER_TARGET.STRIKE_DAMAGE,
      MODIFIER_TARGET.CONDITION_DAMAGE,
    ],
    operation: "damage-additive",
    amount: (_context, target) =>
      target === MODIFIER_TARGET.CONDITION_DAMAGE ? 0.1 : 0.05,
    when: context => timedActive(context, "deadly-blades"),
  },
  {
    id: "mesmer.time-bomb",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.1,
    order: 100,
    when: context => timedActive(context, "time-bomb"),
  },
  {
    id: "mesmer.illusionary-membrane",
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: "damage-additive",
    amount: 0.07,
    when: context => timedActive(context, "illusionary-membrane"),
  },
  {
    id: "mesmer.lute",
    target: [
      MODIFIER_TARGET.STRIKE_DAMAGE,
      MODIFIER_TARGET.CONDITION_DAMAGE,
    ],
    operation: "damage-additive",
    amount: 0.1,
    when: hasLute,
  },
  {
    id: "mesmer.shredding",
    target: [
      MODIFIER_TARGET.STRIKE_DAMAGE,
      MODIFIER_TARGET.CONDITION_DAMAGE,
    ],
    operation: "damage-additive",
    amount: 0.15,
    when: context =>
      hasLute(context) && hasTrait(context, TRAIT.SHREDDING),
  },
  {
    id: "mesmer.altered-chord",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "damage-additive",
    amount: 0.25,
    when: context => timedActive(context, "altered-chord"),
  },
  {
    id: "mesmer.mind-stab-vulnerability",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: context =>
      1 + Number(
        context.timeline?.vulnerabilityStacksAt(context.time) || 0,
      ) * 0.01,
    order: 100,
    when: context => context.event?.skillName === "Mind Stab",
  },
  {
    id: "mesmer.fragility",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: context =>
      1 + Number(
        context.timeline?.vulnerabilityStacksAt(context.time) || 0,
      ) * 0.005,
    order: 100,
    when: context =>
      hasTrait(context, TRAIT.FRAGILITY)
      && context.event?.source !== "Phantasm",
  },
  {
    id: "mesmer.vicious-expression",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: context => context.config.target?.boonless ? 1.15 : 1.1,
    order: 100,
    when: context => hasTrait(context, TRAIT.VICIOUS_EXPRESSION),
  },
  {
    id: "mesmer.empowered-illusions",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.15,
    order: 100,
    when: context =>
      context.event?.source === "Phantasm"
      && hasTrait(context, TRAIT.EMPOWERED_ILLUSIONS),
  },
  {
    id: "mesmer.phantasmal-force",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: context =>
      1 + context.timeline.mightStacksAt(context.time) * 0.01,
    order: 100,
    when: context =>
      context.event?.source === "Phantasm"
      && hasTrait(context, TRAIT.PHANTASMAL_FORCE),
  },
  {
    id: "mesmer.mental-anguish",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: context =>
      context.config.target?.activatingSkills ? 1.25 : 1.5,
    order: 100,
    when: context =>
      context.event?.shatter
      && hasTrait(context, TRAIT.MENTAL_ANGUISH),
  },
  {
    id: "mesmer.infinite-forge",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.07,
    order: 100,
    when: context =>
      context.event?.blade
      && hasTrait(context, TRAIT.INFINITE_FORGE),
  },
  {
    id: "mesmer.mental-focus",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.05,
    order: 100,
    when: context =>
      hasTrait(context, TRAIT.MENTAL_FOCUS)
      && context.config.target?.nearby
      && context.event?.source === "Player",
  },
  {
    id: "mesmer.egotism",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.1,
    order: 100,
    when: context =>
      hasTrait(context, TRAIT.EGOTISM)
      && context.event?.source !== "Phantasm"
      && Number(context.config.target?.health || 0) > 0
      && (
        Number(context.runtime?.totals?.strike || 0)
        + Number(context.runtime?.totals?.condition || 0)
      ) > 0,
  },
  {
    id: "mesmer.event-final-multiplier",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: context => Number(context.event?.multiplier || 1),
    order: 1000,
  },
  {
    id: "mesmer.bloodsong",
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: "multiply",
    factor: 1.25,
    order: 100,
    when: context =>
      context.condition === "Bleeding"
      && hasTrait(context, TRAIT.BLOODSONG),
  },
  {
    id: "mesmer.malicious-sorcery",
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: "add",
    amount: 0.25,
    when: context =>
      context.condition === "Confusion"
      && hasTrait(context, TRAIT.MALICIOUS_SORCERY),
  },
]);

const mesmerModifierHooks = createModifierHooks({
  rules: mesmerModifierRules,
  damageBuckets: {
    strikeDamage: {
      includeSigil: context => !illusionSource(context),
    },
  },
});

export const {
  modifyCriticalChance: applyMesmerCriticalChance,
  modifyCriticalDamage: applyMesmerCriticalDamage,
  modifyStrikeDamage: applyMesmerStrikeDamage,
  modifyConditionDamage: applyMesmerConditionDamage,
  modifyConditionDuration: applyMesmerConditionDuration,
} = mesmerModifierHooks;

export const mesmerAttributeRules = Object.freeze({
  modifyAttributes: applyMesmerAttributes,
  ...mesmerModifierHooks,
});
