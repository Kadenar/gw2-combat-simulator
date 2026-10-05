import { activeBuffStacks, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';

import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { defineSkillVariantProfile as variant } from '#gw2/platform/profession-definition/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';

import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import {
  commitRechargeDuration,
  SPECIALIZED_ELEMENTS_PROFILE_IDS,
  specializedElementsAvailability
} from '#gw2/professions/elementalist/specializations/evoker/traits/attunements.js';
import type { ElementalistModifierContext } from '#gw2/professions/elementalist/types.js';

const boon = (name: string, boonName: string, stacks: number, duration: number): SkillEffect => ({
  type: 'boon',
  name,
  boon: boonName,
  stacks,
  duration
});

/** Owns Evocation tuning at its existing execution boundaries. */
export const evocation = defineTrait({
  id: TRAIT.EVOCATION,
  name: 'Evocation',
  balance: {
    internalCooldown: 5,
    effects: [boon('Fire Familiar', 'might', 1, 6)]
  }
});

/** Owns Elemental Balance tuning at its existing execution boundaries. */
export const elementalBalance = defineTrait({
  id: TRAIT.ELEMENTAL_BALANCE,
  name: 'Elemental Balance',
  balance: {
    threshold: 2,
    durationMultiplier: 5,
    rechargeMultiplier: 0.34
  },
  hooks: { reserveRecharge: commitRechargeDuration }
});

/** Owns Elemental Dynamo tuning at its existing execution boundaries. */
export const elementalDynamo = defineTrait({
  id: TRAIT.ELEMENTAL_DYNAMO,
  name: 'Elemental Dynamo',
  balance: {
    resourceGain: 1
  }
});

/** Owns Specialized Elements tuning at its existing execution boundaries. */
export const specializedElements = defineTrait({
  id: TRAIT.SPECIALIZED_ELEMENTS,
  name: 'Specialized Elements',
  balance: {
    maximumStacks: 6,
    playerStacks: 3
  },
  profiles: [
    variant(
      SPECIALIZED_ELEMENTS_PROFILE_IDS.basicRecharge,
      TRAIT.SPECIALIZED_ELEMENTS,
      'Specialized Elements - Basic Familiar Recharge',
      { rechargeMultiplier: 0.9 }
    ),
    variant(
      SPECIALIZED_ELEMENTS_PROFILE_IDS.empoweredRecharge,
      TRAIT.SPECIALIZED_ELEMENTS,
      'Specialized Elements - Empowered Familiar Recharge',
      { rechargeMultiplier: 0.67 }
    )
  ],
  hooks: { availability: specializedElementsAvailability }
});

/** Owns Galvanic Enchantment tuning at its existing execution boundaries. */
export const galvanicEnchantment = defineTrait({
  id: TRAIT.GALVANIC_ENCHANTMENT,
  name: 'Galvanic Enchantment',
  balance: {
    // Trait and familiar grants consume the same Electric Enchantment pool.
    damagePreviewAttribution: 'shared',
    playerStacks: 2,
    durationMultiplier: 6,
    effects: [
      { name: 'Galvanic Enchantment', type: 'strike', coefficient: 0.4, hits: 1 },
      { name: 'Burning', type: 'condition', condition: 'Burning', stacks: 1, duration: 1.5 }
    ]
  }
});

/** Owns Enhanced Potency tuning at its existing execution boundaries. */
export const enhancedPotency = defineTrait({
  id: TRAIT.ENHANCED_POTENCY,
  name: 'Enhanced Potency',
  balance: {
    criticalChance: 0.15,
    attributeBonus: 75,
    attributePerStack: 5
  },
  modifierRules: [
    {
      id: 'elementalist.enhanced-potency-air',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.ENHANCED_POTENCY), 'criticalChance'),
      when: (context: ElementalistModifierContext) =>
        context.config?.evokerElement === 'Air' &&
        Boolean(context.query?.furyActiveAt(context.time, context.runtime, context.event))
    }
  ]
});

/** Owns Familiar's Prowess tuning at its existing execution boundaries. */
export const familiarsProwess = defineTrait({
  id: TRAIT.FAMILIARS_PROWESS,
  name: "Familiar's Prowess",
  balance: {
    durationMultiplier: 5,
    maximumStacks: 15,
    durationPerTier: 5
  },
  modifierRules: [
    {
      requiresSelection: false,
      id: 'elementalist.familiars-prowess-strike',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      parameters: { baseAmount: 0.05, focusedAmount: 0.1 },
      amount: (context, _target, parameters) =>
        hasTrait(context, TRAIT.FAMILIARS_FOCUS) ? parameters.focusedAmount : parameters.baseAmount,
      when: (context: ElementalistModifierContext) =>
        context.config?.evokerElement === 'Air' && activeBuffStacks(context, 'familiars-prowess', 1) > 0
    },
    {
      requiresSelection: false,
      id: 'elementalist.familiars-prowess-condition',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      parameters: { baseAmount: 0.05, focusedAmount: 0.1 },
      amount: (context, _target, parameters) =>
        hasTrait(context, TRAIT.FAMILIARS_FOCUS) ? parameters.focusedAmount : parameters.baseAmount,
      when: (context: ElementalistModifierContext) =>
        context.config?.evokerElement === 'Fire' && activeBuffStacks(context, 'familiars-prowess', 1) > 0
    }
  ]
});

/** Owns Altruistic Aspect tuning at its existing execution boundaries. */
export const altruisticAspect = defineTrait({
  id: TRAIT.ALTRUISTIC_ASPECT,
  name: 'Altruistic Aspect',
  balance: {
    effects: [
      boon("Fox's Fury", 'might', 3, 10),
      boon("Hare's Agility", 'fury', 1, 5),
      boon("Toad's Fortitude", 'stability', 1, 5),
      boon('Elemental Procession', 'resistance', 1, 5)
    ]
  }
});

/** Owns Familiar's Focus tuning at its existing execution boundaries. */
export const familiarsFocus = defineTrait({
  id: TRAIT.FAMILIARS_FOCUS,
  name: "Familiar's Focus",
  balance: {
    damageIncrease: 0.1
  }
});

/** Owns Familiar's Blessing tuning at its existing execution boundaries. */
export const familiarsBlessing = defineTrait({
  id: TRAIT.FAMILIARS_BLESSING,
  name: "Familiar's Blessing",
  balance: {
    effects: [boon('Quickness', 'quickness', 1, 1.75), boon('Alacrity', 'alacrity', 1, 4)]
  }
});

/** Fiery Might multiplies strikes against burning targets when selected. */
export const fieryMight = defineTrait({
  id: TRAIT.FIERY_MIGHT,
  name: 'Fiery Might',
  modifierRules: [
    {
      id: 'elementalist.fiery-might',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.05,
      when: (context) => targetConditionActive(context, 'Burning')
    }
  ]
});
/** Register evoker traits in their existing execution order. */
export const evokerTraits = [
  evocation,
  fieryMight,
  familiarsProwess,
  enhancedPotency,
  altruisticAspect,
  familiarsFocus,
  familiarsBlessing,
  elementalDynamo,
  galvanicEnchantment,
  elementalBalance,
  specializedElements
];
