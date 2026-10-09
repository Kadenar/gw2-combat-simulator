import { CANONICAL_TARGET_CONDITIONS } from '#gw2/platform/combat/state/targets.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionCount } from '#gw2/platform/combat/query/runtime-query.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';

/** Owns Barbed Precision tuning and behavior at its existing execution boundaries. */
export const barbedPrecision = defineTrait({
  id: TRAIT.BARBED_PRECISION,
  name: 'Barbed Precision',
  balance: {
    conditionDurationMultiplier: 1.2,
    procRate: {
      id: 'necromancer.barbed-precision',
      traitId: TRAIT.BARBED_PRECISION,
      field: 'criticalChance',
      opportunity: 'eligible critical hit'
    },
    criticalChance: 0.33,
    effects: [
      {
        name: 'Bleeding',
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 3,
        actorType: 'effect'
      }
    ]
  },
  modifierRules: [
    {
      order: -9,
      id: 'necromancer.barbed-precision-duration',
      target: MODIFIER_TARGET.CONDITION_DURATION,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.BARBED_PRECISION),
          'conditionDurationMultiplier'
        ),
      when: (context) => context.condition === 'Bleeding' && !professionStaticRulesApplied(context.config)
    }
  ],
  buildAttributes: (_common, { balanceContext: profileContext }) => ({
    traitDurations: {
      'Bleeding Duration':
        balanceProfileNumber(
          requireBalanceProfileFromContext(profileContext, TRAIT.BARBED_PRECISION),
          'conditionDurationMultiplier'
        ) *
          100 -
        100
    }
  })
});

/** Owns Chilling Darkness tuning and behavior at its existing execution boundaries. */
export const chillingDarkness = defineTrait({
  id: TRAIT.CHILLING_DARKNESS,
  name: 'Chilling Darkness',
  balance: {
    cooldown: 3,
    effects: [
      {
        name: 'Chilled',
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 2,
        actorType: 'effect'
      }
    ]
  }
});

/** Owns Insidious Disruption tuning and behavior at its existing execution boundaries. */
export const insidiousDisruption = defineTrait({
  id: TRAIT.INSIDIOUS_DISRUPTION,
  name: 'Insidious Disruption',
  balance: {
    effects: [
      {
        name: 'Torment',
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 5,
        actorType: 'effect'
      }
    ]
  }
});

/** Owns Furious Demise tuning and behavior at its existing execution boundaries. */
export const furiousDemise = defineTrait({
  id: TRAIT.FURIOUS_DEMISE,
  name: 'Furious Demise',
  balance: {
    effects: [{ name: 'fury', type: 'boon', boon: 'fury', stacks: 1, duration: 8, packetLabel: 'on shroud entry' }],
    attributeBonus: 180
  },
  buildAttributes: traitAttributeEffects(TRAIT.FURIOUS_DEMISE, [
    { kind: 'flat', to: 'Precision', field: 'attributeBonus', feedsConversions: true }
  ])
});

/** Owns Target the Weak tuning and behavior at its existing execution boundaries. */
export const targetTheWeak = defineTrait({
  id: TRAIT.TARGET_THE_WEAK,
  name: 'Target the Weak',
  balance: {
    criticalChancePerCondition: 0.02,
    maximumConditions: CANONICAL_TARGET_CONDITIONS.length,
    attributeConversion: 0.13
  },
  modifierRules: [
    {
      order: -19,
      id: 'necromancer.target-the-weak-critical-chance',
      label: 'Target the Weak',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) => {
        // Critical chance counts distinct conditions only up to the selected trait profile's cap.
        const profile = requireBalanceProfileFromContext(context, TRAIT.TARGET_THE_WEAK);
        return (
          Math.min(targetConditionCount(context), balanceProfileNumber(profile, 'maximumConditions')) *
          balanceProfileNumber(profile, 'criticalChancePerCondition')
        );
      }
    }
  ],
  buildAttributes: traitAttributeEffects(TRAIT.TARGET_THE_WEAK, [
    {
      kind: 'conversion',
      from: 'Precision',
      to: 'Condition Damage',
      field: 'attributeConversion',
      rounding: 'floor',
      input: 'eligible'
    }
  ])
});

/** Owns Lingering Curse tuning and behavior at its existing execution boundaries. */
export const lingeringCurse = defineTrait({
  id: TRAIT.LINGERING_CURSE,
  name: 'Lingering Curse',
  balance: {
    attributeBonus: 200,
    durationMultiplier: 1.5
  },
  buildAttributes: traitAttributeEffects(TRAIT.LINGERING_CURSE, [
    { kind: 'flat', to: 'Condition Damage', field: 'attributeBonus', feedsConversions: false }
  ])
});

/** Owns Weakening Shroud tuning and behavior at its existing execution boundaries. */
export const weakeningShroud = defineTrait({
  id: TRAIT.WEAKENING_SHROUD,
  name: 'Weakening Shroud',
  balance: {
    effects: [
      { name: 'Strike', type: 'strike', coefficient: 1.5, hits: 1 },
      { name: 'Bleeding', type: 'condition', condition: 'Bleeding', stacks: 2, duration: 10 },
      { name: 'Weakness', type: 'condition', condition: 'Weakness', stacks: 1, duration: 6 }
    ]
  }
});

/** Owns Master of Corruption tuning and behavior at its existing execution boundaries. */
export const masterOfCorruption = defineTrait({
  id: TRAIT.MASTER_OF_CORRUPTION,
  name: 'Master of Corruption',
  balance: { rechargeMultiplier: 0.67 },
  rechargeRules: [
    {
      order: 0,

      when: (_runtime, skill) => Boolean(skill.categories?.includes('Corruption')),
      multiplier: { profile: TRAIT.MASTER_OF_CORRUPTION, field: 'rechargeMultiplier' }
    }
  ]
});

/** Owns Plague Sending tuning and behavior at its existing execution boundaries. */
export const plagueSending = defineTrait({
  id: TRAIT.PLAGUE_SENDING,
  name: 'Plague Sending',
  balance: { maximumConditions: 2 }
});

/** Terror adds damage to the skill's Fear application without creating another condition or control reaction. */
export const terror = defineTrait({
  id: TRAIT.TERROR,
  name: 'Terror',
  hooks: {
    prepareEvent: (runtime, event) =>
      event.type === 'condition' && event.condition === 'Fear' && hasTrait(runtime, TRAIT.TERROR)
        ? { ...event, conditionDamageFormula: TERROR_DAMAGE }
        : event
  }
});

const TERROR_DAMAGE = Object.freeze({ base: 444, scaling: 0.4 });
