import { MESMER_TRAIT_IDS as TRAIT } from "../data/ids.js";
import {
  createModifierHooks,
  MODIFIER_TARGET,
} from "../../../platform/gw2/modifier-rules.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";
import type {
  Gw2ModifierContext,
  Gw2ModifierRule,
  Gw2QueryRuntime,
  Gw2ResolvedStats,
} from "../../../platform/gw2/types.js";

const EPSILON = 0.0001;

export function illusionSource(context: Gw2ModifierContext): boolean {
  return (
    context.event?.source === "Clone" || context.event?.source === "Phantasm"
  );
}

export function timedStacks(
  context: Gw2ModifierContext,
  kind: string,
  duration: number,
  maximum: number,
): number {
  return (
    context.timeline?.timedStacks(kind, context.time, duration, maximum) || 0
  );
}

export function timedActive(
  context: Gw2ModifierContext,
  kind: string,
): boolean {
  return Boolean(context.timeline?.timedActive(kind, context.time));
}

function thornsStacksAt(time: number): number {
  if (time < 3 - EPSILON) return 0;
  return Math.min(10, Math.floor((time - 3 + EPSILON) / 5) + 1);
}

export function applyMesmerCoreAttributes(
  context: Gw2ModifierContext,
  attributes: Gw2ResolvedStats,
): Gw2ResolvedStats {
  const thorns =
    context.config?.relic === "Thorns" ? thornsStacksAt(context.time) * 30 : 0;
  const midnight =
    Array.isArray(context.config?.selectedSkills) &&
    context.config.selectedSkills.includes("Signet of Midnight") &&
    context.timeline?.skillOnCooldownAt(10234, context.time)
      ? 180
      : 0;
  const domination =
    Array.isArray(context.config?.selectedSkills) &&
    context.config.selectedSkills.includes("Signet of Domination") &&
    context.timeline?.skillOnCooldownAt(10232, context.time)
      ? 180
      : 0;
  return {
    ...attributes,
    power: Number(attributes.power || 0),
    precision: Number(attributes.precision || 0),
    ferocity:
      Number(attributes.ferocity || 0) +
      timedStacks(context, "fencer", 6, 10) * 15,
    conditionDamage:
      Number(attributes.conditionDamage || 0) + thorns - domination,
    expertise: Number(attributes.expertise || 0) - midnight,
  };
}

function superiorityComplexFactor(context: Gw2ModifierContext): number {
  const targetHealth = Number(context.config?.target?.health || 0);
  const totalDamage = resolvedTotalDamage(context);
  return context.config?.target?.disabled ||
    (targetHealth > 0 && totalDamage >= targetHealth * 0.5)
    ? 1.25
    : 1.15;
}

function resolvedTotalDamage(context: Gw2ModifierContext): number {
  const runtime = context.runtime as
    | (Gw2QueryRuntime & {
        readonly totals?: {
          readonly strike?: number;
          readonly condition?: number;
        };
      })
    | null
    | undefined;
  return (
    Number(runtime?.totals?.strike || 0) +
    Number(runtime?.totals?.condition || 0)
  );
}

export const mesmerCoreModifierRules: readonly Gw2ModifierRule[] =
  Object.freeze([
  {
    id: "mesmer.illusion-config-critical-chance",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: (context) =>
      -Number(context.config?.stats?.criticalChanceBonus || 0) / 100,
    when: illusionSource,
  },
  {
    id: "mesmer.illusion-sigil-critical-chance",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: (context) =>
      -Number(
        context.timeline?.activeSigilSetAt(context.time)?.criticalChanceBonus ||
          0,
      ) / 100,
    when: illusionSource,
  },
  {
    id: "mesmer.illusion-fury-critical-chance",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: -0.25,
    when: (context) =>
      illusionSource(context) &&
      Boolean(context.timeline?.furyActiveAt(context.time)),
  },
  {
    id: "mesmer.mistburn-critical-chance",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: 0.1,
    when: (context) =>
      !illusionSource(context) &&
      context.config?.relic === "Mistburn" &&
      Number(context.timeline?.mightStacksAt(context.time) || 0) >= 10,
  },
  {
    id: "mesmer.phantasmal-fury-critical-chance",
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: "add",
    amount: (context) =>
      context.config?.specialization === "Virtuoso" ? 0.4 : 0.25,
    when: (context) =>
      context.event?.source === "Phantasm" &&
      hasTrait(context, TRAIT.PHANTASMAL_FURY),
  },
  {
    id: "mesmer.superiority-complex",
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: "multiply",
    factor: superiorityComplexFactor,
    when: (context) =>
      hasTrait(context, TRAIT.SUPERIORITY_COMPLEX) &&
      context.event?.source !== "Phantasm",
  },
  {
    id: "mesmer.compounding-power",
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: "damage-additive",
    amount: (context, target) =>
      timedStacks(context, "compounding", 8, 5) *
      (target === MODIFIER_TARGET.STRIKE_DAMAGE ? 0.02 : 0.01),
    when: (context) => !illusionSource(context),
  },
  {
    id: "mesmer.illusionary-membrane",
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: "damage-additive",
    amount: 0.07,
    when: (context) => timedActive(context, "illusionary-membrane"),
  },
  {
    id: "mesmer.mind-stab-vulnerability",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: (context) =>
      1 +
      Number(context.timeline?.vulnerabilityStacksAt(context.time) || 0) * 0.01,
    order: 100,
    when: (context) => context.event?.skillName === "Mind Stab",
  },
  {
    id: "mesmer.fragility",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: (context) =>
      1 +
      Number(context.timeline?.vulnerabilityStacksAt(context.time) || 0) *
        0.005,
    order: 100,
    when: (context) =>
      hasTrait(context, TRAIT.FRAGILITY) &&
      context.event?.source !== "Phantasm",
  },
  {
    id: "mesmer.vicious-expression",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: (context) => (context.config?.target?.boonless ? 1.15 : 1.1),
    order: 100,
    when: (context) => hasTrait(context, TRAIT.VICIOUS_EXPRESSION),
  },
  {
    id: "mesmer.empowered-illusions",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.15,
    order: 100,
    when: (context) =>
      context.event?.source === "Phantasm" &&
      hasTrait(context, TRAIT.EMPOWERED_ILLUSIONS),
  },
  {
    id: "mesmer.phantasmal-force",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: (context) =>
      1 + context.timeline!.mightStacksAt(context.time) * 0.01,
    order: 100,
    when: (context) =>
      context.event?.source === "Phantasm" &&
      hasTrait(context, TRAIT.PHANTASMAL_FORCE),
  },
  {
    id: "mesmer.mental-anguish",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: (context) =>
      context.config?.target?.activatingSkills ? 1.25 : 1.5,
    order: 100,
    when: (context) =>
      Boolean(context.event?.shatter) &&
      hasTrait(context, TRAIT.MENTAL_ANGUISH),
  },
  {
    id: "mesmer.egotism",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: 1.1,
    order: 100,
    when: (context) =>
      hasTrait(context, TRAIT.EGOTISM) &&
      context.event?.source !== "Phantasm" &&
      Number(context.config?.target?.health || 0) > 0 &&
      resolvedTotalDamage(context) > 0,
  },
  {
    id: "mesmer.event-final-multiplier",
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: "multiply",
    factor: (context) => Number(context.event?.multiplier || 1),
    order: 1000,
  },
  {
    id: "mesmer.malicious-sorcery",
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: "add",
    amount: 0.25,
    when: (context) =>
      context.condition === "Confusion" &&
      hasTrait(context, TRAIT.MALICIOUS_SORCERY),
  },
]);

export function compileMesmerModifierRules(
  rules: readonly Gw2ModifierRule[],
): ReturnType<typeof createModifierHooks> {
  return createModifierHooks({
    rules,
    damageBuckets: {
      strikeDamage: {
        includeSigil: (context) => !illusionSource(context),
      },
    },
  });
}

export const mesmerCoreAttributeRules = Object.freeze({
  modifyAttributes: applyMesmerCoreAttributes,
  modifierRules: mesmerCoreModifierRules,
  compileModifierRules: compileMesmerModifierRules,
});
