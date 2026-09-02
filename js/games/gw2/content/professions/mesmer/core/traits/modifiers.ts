/** Applies Core Mesmer trait and equipment modifiers at the shared modifier boundary. */
import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { EPSILON } from '#kernel/core/clock.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import { createModifierHooks, MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { targetHealthLoss } from '#gw2/platform/combat/state/target-health.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/mesmer/data/ids.js';
import { MESMER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/mesmer/core/profiles.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/query/types.js';

export function illusionSource(context: Gw2ModifierContext): boolean {
  return context.event?.source === 'Clone' || context.event?.source === 'Phantasm';
}

export function timedStacks(context: Gw2ModifierContext, kind: string, duration: number, maximum: number): number {
  return context.timeline?.timedStacks(kind, context.time, duration, maximum) || 0;
}

export function timedActive(context: Gw2ModifierContext, kind: string): boolean {
  return Boolean(context.timeline?.timedActive(kind, context.time));
}

function thornsStacksAt(time: number): number {
  if (time < 3 - EPSILON) return 0;
  return Math.min(10, Math.floor((time - 3 + EPSILON) / 5) + 1);
}

// Reconcile build-time Mesmer bonuses with live relic stacks, timed trait stacks,
// and signet cooldowns so panel-visible attributes are neither lost nor doubled.
export function applyMesmerCoreAttributes(context: Gw2ModifierContext, attributes: Gw2ResolvedStats): Gw2ResolvedStats {
  const selectedSkills = selectedSkillNameSet(context.config?.selectedSkills);
  const thorns = context.config?.relic === 'Thorns' ? thornsStacksAt(context.time) * 30 : 0;
  const midnightSelected = selectedSkills.has('Signet of Midnight');
  const midnightBonus = balanceProfileValueFromContext(context, PROFILE.signetOfMidnight, 'expertiseBonus', 180);
  const midnight = midnightSelected && context.timeline?.skillOnCooldownAt(10234, context.time) ? midnightBonus : 0;
  const dominationSelected = selectedSkills.has('Signet of Domination');
  const dominationBonus = balanceProfileValueFromContext(
    context,
    PROFILE.signetOfDomination,
    'conditionDamageBonus',
    180
  );
  const domination =
    dominationSelected && context.timeline?.skillOnCooldownAt(10232, context.time) ? dominationBonus : 0;
  const chaoticExpertiseDelta = hasTrait(context, PROFILE.chaoticPersistence)
    ? balanceProfileValueFromContext(context, PROFILE.chaoticPersistence, 'expertiseBonus', 100) - 100
    : 0;
  return {
    ...attributes,
    power: Number(attributes.power || 0),
    precision: Number(attributes.precision || 0),
    ferocity:
      Number(attributes.ferocity || 0) +
      timedStacks(
        context,
        'fencer',
        balanceProfileValueFromContext(context, PROFILE.fencersFinesse, 'durationMultiplier', 6),
        balanceProfileValueFromContext(context, PROFILE.fencersFinesse, 'maximumStacks', 10)
      ) *
        balanceProfileValueFromContext(context, PROFILE.fencersFinesse, 'attributePerStack', 15),
    conditionDamage:
      Number(attributes.conditionDamage || 0) + thorns + (dominationSelected ? dominationBonus - 180 : 0) - domination,
    expertise:
      Number(attributes.expertise || 0) +
      chaoticExpertiseDelta +
      (midnightSelected ? midnightBonus - 180 : 0) -
      midnight,
    concentration:
      Number(attributes.concentration || 0) +
      (hasTrait(context, PROFILE.chaoticPersistence)
        ? balanceProfileValueFromContext(context, PROFILE.chaoticPersistence, 'concentrationBonus', 250) - 250
        : 0)
  };
}

const modifierParameters = (values: Record<string, number>): Readonly<Record<string, number>> => Object.freeze(values);

function superiorityComplexTargetControlled(context: Gw2ModifierContext): boolean {
  return ['Fear', 'Taunt'].some((condition) => targetConditionActive(context, condition));
}

function superiorityComplexFactor(
  context: Gw2ModifierContext,
  _target: string,
  parameters: Readonly<Record<string, number>>
): number {
  const targetHealth = Number(context.config?.target?.health || 0);
  const totalDamage = targetHealthLoss(context.config, context.runtime);
  const target = context.config?.target;
  // Generic disables apply only to non-defiant targets, while configured Fear
  // or Taunt remains an explicit control condition on defiant targets.
  return (target?.disabled && !target.defiant) ||
    superiorityComplexTargetControlled(context) ||
    (targetHealth > 0 && totalDamage >= targetHealth * parameters.threshold)
    ? parameters.lowHealthOrDisabledFactor
    : parameters.highHealthFactor;
}

export const mesmerCoreModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'mesmer.phantasmal-fury-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.25,
    when: (context) => context.event?.source === 'Phantasm' && hasTrait(context, TRAIT.PHANTASMAL_FURY)
  },
  {
    id: 'mesmer.superiority-complex',
    target: MODIFIER_TARGET.CRITICAL_DAMAGE,
    operation: 'multiply',
    parameters: modifierParameters({
      highHealthFactor: 1.15,
      lowHealthOrDisabledFactor: 1.25,
      threshold: 0.5
    }),
    factor: superiorityComplexFactor,
    when: (context) => hasTrait(context, TRAIT.SUPERIORITY_COMPLEX) && !illusionSource(context)
  },
  {
    id: 'mesmer.compounding-power',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    parameters: modifierParameters({
      duration: 8,
      maximumStacks: 5,
      strikePerStack: 0.02,
      conditionPerStack: 0.01
    }),
    amount: (context, target, parameters) => {
      // Illusion strikes use summon ownership, while their applied conditions inherit the Mesmer's outgoing modifiers.
      if (target === MODIFIER_TARGET.STRIKE_DAMAGE && illusionSource(context)) return 0;
      return (
        timedStacks(context, 'compounding', parameters.duration, parameters.maximumStacks) *
        (target === MODIFIER_TARGET.STRIKE_DAMAGE ? parameters.strikePerStack : parameters.conditionPerStack)
      );
    }
  },
  {
    id: 'mesmer.illusionary-membrane',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    amount: 0.07,
    when: (context) => timedActive(context, 'illusionary-membrane')
  },
  {
    id: 'mesmer.mind-stab-vulnerability',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: modifierParameters({ baseFactor: 1, damagePerStack: 0.01 }),
    factor: (context, _target, parameters) =>
      parameters.baseFactor +
      Number(context.query?.vulnerabilityStacksAt(context.time, context.runtime) || 0) * parameters.damagePerStack,
    order: 100,
    when: (context) => context.event?.skillName === 'Mind Stab'
  },
  {
    id: 'mesmer.fragility',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: modifierParameters({ baseFactor: 1, damagePerStack: 0.005 }),
    factor: (context, _target, parameters) =>
      parameters.baseFactor +
      Number(context.query?.vulnerabilityStacksAt(context.time, context.runtime) || 0) * parameters.damagePerStack,
    order: 100,
    when: (context) => hasTrait(context, TRAIT.FRAGILITY) && !illusionSource(context)
  },
  {
    id: 'mesmer.vicious-expression',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: modifierParameters({
      boonlessFactor: 1.15,
      normalFactor: 1.1
    }),
    factor: (context, _target, parameters) =>
      context.config?.target?.boonless ? parameters.boonlessFactor : parameters.normalFactor,
    order: 100,
    when: (context) => hasTrait(context, TRAIT.VICIOUS_EXPRESSION)
  },
  {
    id: 'mesmer.empowered-illusions',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.15,
    order: 100,
    when: (context) => illusionSource(context) && hasTrait(context, TRAIT.EMPOWERED_ILLUSIONS)
  },
  {
    id: 'mesmer.phantasmal-force',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: modifierParameters({ baseFactor: 1, damagePerMight: 0.01 }),
    factor: (context, _target, parameters) =>
      parameters.baseFactor +
      context.query!.mightStacksAt(context.time, context.runtime, context.event) * parameters.damagePerMight,
    order: 100,
    when: (context) => context.event?.source === 'Phantasm' && hasTrait(context, TRAIT.PHANTASMAL_FORCE)
  },
  {
    id: 'mesmer.mental-anguish',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: modifierParameters({
      activatingFactor: 1.25,
      idleFactor: 1.5
    }),
    factor: (context, _target, parameters) =>
      context.config?.target?.activatingSkills ? parameters.activatingFactor : parameters.idleFactor,
    order: 100,
    // Repeat packets are still shatter damage, but the skill contract limits shatter traits to the first strike.
    when: (context) => Boolean(context.event?.shatterTraitEligible) && hasTrait(context, TRAIT.MENTAL_ANGUISH)
  },
  {
    id: 'mesmer.egotism',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    order: 100,
    when: (context) =>
      hasTrait(context, TRAIT.EGOTISM) &&
      !illusionSource(context) &&
      Number(context.config?.target?.health || 0) > 0 &&
      targetHealthLoss(context.config, context.runtime) > 0
  },
  {
    id: 'mesmer.event-final-multiplier',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    parameters: modifierParameters({ fallbackFactor: 1 }),
    factor: (context, _target, parameters) => Number(context.event?.multiplier || parameters.fallbackFactor),
    order: 1000
  },
  {
    id: 'mesmer.malicious-sorcery',
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: 'add',
    amount: 0.25,
    // Panel-derived simulation stats already contain this static bonus; provenance keeps direct simulations compatible.
    when: (context) =>
      context.condition === 'Confusion' &&
      hasTrait(context, TRAIT.MALICIOUS_SORCERY) &&
      !professionStaticRulesApplied(context.config)
  }
]);

export function compileMesmerModifierRules(rules: readonly Gw2ModifierRule[]): ReturnType<typeof createModifierHooks> {
  return createModifierHooks({
    rules,
    damageBuckets: {
      strikeDamage: {
        includeSigil: (context) => !illusionSource(context)
      }
    }
  });
}

export const mesmerCoreAttributeRules = Object.freeze({
  modifyAttributes: applyMesmerCoreAttributes,
  modifierRules: mesmerCoreModifierRules,
  compileModifierRules: compileMesmerModifierRules
});
