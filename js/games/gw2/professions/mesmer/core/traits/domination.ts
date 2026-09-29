import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetHealthLoss } from '#gw2/platform/combat/state/target-health.js';
import { missesTarget } from '#gw2/platform/combat/state/targets.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { illusionSource } from '#gw2/professions/mesmer/core/mechanics/modifier-queries.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

/** Accepted player or summon control grants Vulnerability before imperative control reactions. */
export const dazzling = defineTrait({
  id: TRAIT.DAZZLING,
  name: 'Dazzling',
  balance: {
    effects: [{ name: 'Vulnerability', type: 'condition', condition: 'Vulnerability', stacks: 5, duration: 8 }]
  },
  triggers: [
    {
      on: 'control.resolved',
      emit: TRAIT.DAZZLING,
      when: (_runtime, event) => !missesTarget(event) && (event.actorType === 'player' || event.actorType === 'summon'),
      effects: (effect) => effect.type === 'condition' && effect.name === 'Vulnerability',
      attribution: { source: 'Trait', sourceId: TRAIT.DAZZLING, actorType: 'effect', ownerActorType: 'player' }
    }
  ]
});

/** Vulnerability increases owner strikes; clone and phantasm strikes remain excluded. */
export const fragility = defineTrait({
  id: TRAIT.FRAGILITY,
  name: 'Fragility',
  modifierRules: [
    {
      id: 'mesmer.fragility',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      parameters: Object.freeze({ baseFactor: 1, damagePerStack: 0.005 }),
      factor: (context, _target, parameters) =>
        parameters.baseFactor +
        (context.query?.vulnerabilityStacksAt(context.time, context.runtime) || 0) * parameters.damagePerStack,
      order: 95,
      when: (context) => !illusionSource(context)
    }
  ]
});

/** The simulated target has no boons, so selected Vicious Expression always grants its strike bonus. */
export const viciousExpression = defineTrait({
  id: TRAIT.VICIOUS_EXPRESSION,
  name: 'Vicious Expression',
  modifierRules: [
    {
      id: 'mesmer.vicious-expression',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      // The target never has boons, so the full bonus always applies.
      factor: 1.15,
      order: 96
    }
  ]
});

/** Only clone and phantasm strikes receive the selected illusion multiplier. */
export const empoweredIllusions = defineTrait({
  id: TRAIT.EMPOWERED_ILLUSIONS,
  name: 'Empowered Illusions',
  modifierRules: [
    {
      id: 'mesmer.empowered-illusions',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.15,
      order: 97,
      when: (context) => illusionSource(context)
    }
  ]
});

/** The first eligible shatter strike uses the activating or idle target multiplier. */
export const mentalAnguish = defineTrait({
  id: TRAIT.MENTAL_ANGUISH,
  name: 'Mental Anguish',
  modifierRules: [
    {
      id: 'mesmer.mental-anguish',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      parameters: Object.freeze({
        activatingFactor: 1.25,
        idleFactor: 1.5
      }),
      factor: (context, _target, parameters) =>
        context.config?.target?.activatingSkills ? parameters.activatingFactor : parameters.idleFactor,
      order: 99,
      // Repeat packets are still shatter damage, but the skill contract limits shatter traits to the first strike.
      when: (context) => Boolean(context.event?.metadata?.shatterTraitEligible)
    }
  ]
});

/** At fixed full player health, Egotism benefits owner strikes only after the target loses health. */
export const egotism = defineTrait({
  id: TRAIT.EGOTISM,
  name: 'Egotism',
  modifierRules: [
    {
      id: 'mesmer.egotism',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.1,
      order: 100,
      when: (context) =>
        !illusionSource(context) &&
        (context.config?.target?.health || 0) > 0 &&
        targetHealthLoss(context.config, context.runtime) > 0
    }
  ]
});

/** Extra berserkers and committed Mirror Blade bounces share the same active balance profile. */
export const bountifulBlades = defineTrait({
  id: TRAIT.BOUNTIFUL_BLADES,
  name: 'Bountiful Blades',
  balance: {
    summons: 2,
    damageMultiplier: 0.66,
    effects: [
      {
        name: 'Strike',
        type: 'strike',
        ticks: [
          { atMs: 1240, coefficient: 0.0000064 },
          { atMs: 1400, coefficient: 0.000000256 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  }
});

export const mesmerDominationTraits = [
  dazzling,
  fragility,
  viciousExpression,
  empoweredIllusions,
  mentalAnguish,
  egotism,
  bountifulBlades
];
