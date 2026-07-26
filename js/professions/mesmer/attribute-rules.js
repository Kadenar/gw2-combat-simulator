import { MESMER_TRAIT_IDS as TRAIT } from "./data/ids.js";
import {
  applyAdditiveDamageBucket,
} from "../../platform/gw2/damage-modifier-buckets.js";

const EPSILON = 0.0001;

function hasTrait(context, id) {
  if (context.traits?.has(id) || context.traits?.has(String(id))) return true;
  return [
    ...(context.config?.traitIds || []),
    ...(context.config?.selectedTraitIds || []),
    ...(context.config?.selectedTraits || []),
  ].some(value => value === id || String(value) === String(id));
}

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

export function applyMesmerCriticalChance(context, initialValue) {
  const event = context.event || {};
  const illusion = illusionSource(context);
  let value = Number(initialValue || 0);
  if (illusion) {
    value -= Number(context.config.stats?.criticalChanceBonus || 0) / 100;
    value -= Number(
      context.timeline?.activeSigilSetAt(context.time)
        ?.criticalChanceBonus || 0,
    ) / 100;
    if (context.timeline?.furyActiveAt(context.time)) value -= 0.25;
  } else if (
    context.config.relic === "Mistburn"
    && context.timeline?.mightStacksAt(context.time) >= 10
  ) {
    value += 0.1;
  }
  if (
    hasTrait(context, TRAIT.FLOW_OF_TIME)
    && context.config.boons?.alacrity
    && ["Player", "Clone", "Phantasm"].includes(event.source)
  ) value += 0.15;
  if (
    !illusion
    && hasTrait(context, TRAIT.QUIET_INTENSITY)
    && context.timeline?.furyActiveAt(context.time)
  ) value += 0.15;
  if (event.source === "Phantasm" && hasTrait(context, TRAIT.PHANTASMAL_FURY)) {
    value += context.config.specialization === "Virtuoso" ? 0.4 : 0.25;
  }
  return Math.max(0, Math.min(1, value));
}

export function applyMesmerCriticalDamage(context, initialValue) {
  const event = context.event || {};
  let value = Number(initialValue || 1);
  if (
    hasTrait(context, TRAIT.SUPERIORITY_COMPLEX)
    && event.source !== "Phantasm"
  ) {
    const targetHealth = Number(context.config.target?.health || 0);
    const totalDamage =
      Number(context.runtime?.totals?.strike || 0)
      + Number(context.runtime?.totals?.condition || 0);
    const enhanced =
      Boolean(context.config.target?.disabled)
      || (targetHealth > 0 && totalDamage >= targetHealth * 0.5);
    value *= enhanced ? 1.25 : 1.15;
  }
  if (
    hasTrait(context, TRAIT.DANGER_TIME)
    && (event.source === "Player" || event.source === "Clone")
    && timedActive(context, "danger-time")
  ) value *= 1.05;
  return value;
}

function commonDamageModifiers(context, condition) {
  let additive = 0;
  let multiplicative = 1;
  if (
    hasTrait(context, TRAIT.NOMADS_ENDURANCE)
    && context.timeline?.vigorActiveAt(context.time)
  ) additive += condition ? 0.05 : 0.1;
  if (!illusionSource(context)) {
    additive += timedStacks(context, "compounding", 8, 5) * 0.01;
  }
  additive += timedStacks(context, "phantom-pain", 10, 4)
    * (condition ? 0.05 : 0.0625);
  if (timedActive(context, "deadly-blades")) {
    additive += condition ? 0.1 : 0.05;
  }
  if (!condition && timedActive(context, "time-bomb")) {
    multiplicative *= 1.1;
  }
  if (condition && timedActive(context, "illusionary-membrane")) {
    additive += 0.07;
  }
  const lute = instrumentsAt(context)
    .some(event => event.instrument === "Lute");
  if (lute) {
    additive += 0.1;
    if (hasTrait(context, TRAIT.SHREDDING)) additive += 0.15;
  }
  if (!condition && timedActive(context, "altered-chord")) additive += 0.25;
  return { additive, multiplicative };
}

export function applyMesmerStrikeDamage(context, initialValue) {
  const event = context.event || {};
  const modifiers = commonDamageModifiers(context, false);
  let value = applyAdditiveDamageBucket(context, initialValue, {
    bonus: modifiers.additive,
    includeSigil: !illusionSource(context),
  }) * modifiers.multiplicative;
  const vulnerability =
    context.timeline?.vulnerabilityStacksAt(context.time) || 0;
  if (event.skillName === "Mind Stab") {
    value *= 1 + vulnerability * 0.01;
  }
  if (hasTrait(context, TRAIT.FRAGILITY) && event.source !== "Phantasm") {
    value *= 1 + vulnerability * 0.005;
  }
  if (hasTrait(context, TRAIT.VICIOUS_EXPRESSION)) {
    value *= 1.1;
    if (context.config.target?.boonless) value *= 1.15 / 1.1;
  }
  if (event.source === "Phantasm") {
    if (hasTrait(context, TRAIT.EMPOWERED_ILLUSIONS)) value *= 1.15;
    if (hasTrait(context, TRAIT.PHANTASMAL_FORCE)) {
      value *= 1 + context.timeline.mightStacksAt(context.time) * 0.01;
    }
  }
  if (event.shatter && hasTrait(context, TRAIT.MENTAL_ANGUISH)) {
    value *= context.config.target?.activatingSkills ? 1.25 : 1.5;
  }
  if (event.blade && hasTrait(context, TRAIT.INFINITE_FORGE)) value *= 1.07;
  if (
    hasTrait(context, TRAIT.MENTAL_FOCUS)
    && context.config.target?.nearby
    && event.source === "Player"
  ) value *= 1.05;
  if (
    hasTrait(context, TRAIT.EGOTISM)
    && event.source !== "Phantasm"
    && Number(context.config.target?.health || 0) > 0
    && (
      Number(context.runtime?.totals?.strike || 0)
      + Number(context.runtime?.totals?.condition || 0)
    ) > 0
  ) value *= 1.1;
  return value * Number(event.multiplier || 1);
}

export function applyMesmerConditionDamage(context, initialValue) {
  const modifiers = commonDamageModifiers(context, true);
  let value = applyAdditiveDamageBucket(context, initialValue, {
    damageType: "condition",
    bonus: modifiers.additive,
  }) * modifiers.multiplicative;
  if (
    context.condition === "Bleeding"
    && hasTrait(context, TRAIT.BLOODSONG)
  ) value *= 1.25;
  return value;
}

export function applyMesmerConditionDuration(context, initialValue) {
  return (
    context.condition === "Confusion"
    && hasTrait(context, TRAIT.MALICIOUS_SORCERY)
  )
    ? Math.min(2, Number(initialValue || 1) + 0.25)
    : initialValue;
}

export const mesmerAttributeRules = Object.freeze({
  modifyAttributes: applyMesmerAttributes,
  modifyCriticalChance: applyMesmerCriticalChance,
  modifyCriticalDamage: applyMesmerCriticalDamage,
  modifyStrikeDamage: applyMesmerStrikeDamage,
  modifyConditionDamage: applyMesmerConditionDamage,
  modifyConditionDuration: applyMesmerConditionDuration,
});
