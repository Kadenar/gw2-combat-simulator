import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetHealthBelow } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { observeElementalistTransition } from '#gw2/professions/elementalist/core/mechanics/elite-events.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';

/** Air definitions keep active tuning beside their behavior; explicit calls preserve mechanic ordering. */
export const zephyrsSpeed = defineTrait({
  id: TRAIT.ZEPHYRS_SPEED,
  name: "Zephyr's Speed",
  balance: { criticalChance: 0.05 },
  modifierRules: [
    {
      order: -4,
      id: 'elementalist.zephyrs-speed-critical-chance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.ZEPHYRS_SPEED), 'criticalChance'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ],
  buildAttributes: (_common, { balanceContext }) => ({
    traitCriticalChance:
      100 *
      balanceProfileNumber(requireBalanceProfileFromContext(balanceContext, TRAIT.ZEPHYRS_SPEED), 'criticalChance')
  })
});

export const freshAir = defineTrait({
  id: TRAIT.FRESH_AIR,
  name: 'Fresh Air',
  // Record the accepted proc once before the active elite observes its transition.
  hooks: { eventHandlers: { 'elementalist.fresh-air': observeElementalistTransition } },
  balance: {
    attributeBonus: 250,
    effects: [{ name: 'fresh-air', type: 'buff', kind: 'fresh-air', stacks: 1, duration: 5 }]
  }
});

export const zephyrsBoon = defineTrait({
  id: TRAIT.ZEPHYRS_BOON,
  name: "Zephyr's Boon",
  balance: {
    effects: [
      { type: 'boon', name: 'Fury', boon: 'fury', stacks: 1, duration: 5 },
      { type: 'boon', name: 'Swiftness', boon: 'swiftness', stacks: 1, duration: 5 }
    ]
  }
});

export const oneWithAir = defineTrait({
  id: TRAIT.ONE_WITH_AIR,
  name: 'One with Air',
  balance: {
    effects: [{ type: 'buff', name: 'Superspeed', kind: 'superspeed', stacks: 1, duration: 3 }]
  }
});

export const ferociousWinds = defineTrait({
  id: TRAIT.FEROCIOUS_WINDS,
  name: 'Ferocious Winds',
  balance: { attributeConversion: 0.07 },
  buildAttributes: (_common, { balanceContext }) => {
    const profile = requireBalanceProfileFromContext(balanceContext, TRAIT.FEROCIOUS_WINDS);
    return {
      attributeEffects: [
        {
          kind: 'conversion',
          from: 'Precision',
          to: 'Ferocity',
          multiplier: balanceProfileNumber(profile, 'attributeConversion'),
          rounding: 'round',
          input: 'common'
        }
      ]
    };
  }
});

export const electricDischarge = defineTrait({
  id: TRAIT.ELECTRIC_DISCHARGE,
  name: 'Electric Discharge',
  balance: {
    criticalDamage: 2,
    effects: [
      {
        type: 'strike',
        name: 'Electric Discharge',
        coefficient: 0.35,
        hits: 1
      },
      { type: 'condition', name: 'Electric Discharge', condition: 'Vulnerability', stacks: 1, duration: 8 }
    ]
  },
  modifierRules: [
    {
      requiresSelection: false,
      order: -3,
      id: 'elementalist.electric-discharge-critical-damage',
      target: MODIFIER_TARGET.CRITICAL_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.ELECTRIC_DISCHARGE), 'criticalDamage'),
      when: (context) => (context.event?.skillName || context.event?.name || '') === 'Electric Discharge'
    }
  ]
});

export const inscription = defineTrait({
  id: TRAIT.INSCRIPTION,
  name: 'Inscription',
  balance: {
    effects: [
      { type: 'boon', name: 'Fire', boon: 'might', stacks: 1, duration: 10 },
      { type: 'boon', name: 'Water', boon: 'regeneration', stacks: 1, duration: 10 },
      { type: 'boon', name: 'Air', boon: 'swiftness', stacks: 1, duration: 10 },
      { type: 'boon', name: 'Earth', boon: 'protection', stacks: 1, duration: 3 },
      { type: 'boon', name: 'Air Entry', boon: 'resistance', stacks: 1, duration: 3 }
    ]
  }
});

export const ragingStorm = defineTrait({
  id: TRAIT.RAGING_STORM,
  name: 'Raging Storm',
  balance: {
    internalCooldown: 8,
    attributeBonus: 180,
    effects: [{ type: 'boon', name: 'Fury', boon: 'fury', stacks: 1, duration: 4 }]
  }
});

export const aeromancersTraining = defineTrait({
  id: TRAIT.AEROMANCERS_TRAINING,
  name: "Aeromancer's Training",
  balance: {
    attributeBonus: 150,
    rechargeMultiplier: 0.8
  },
  buildAttributes: (_common, { balanceContext }) => {
    const profile = requireBalanceProfileFromContext(balanceContext, TRAIT.AEROMANCERS_TRAINING);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Ferocity',
          amount: balanceProfileNumber(profile, 'attributeBonus'),
          feedsConversions: false
        }
      ]
    };
  }
});

export const lightningRod = defineTrait({
  id: TRAIT.LIGHTNING_ROD,
  name: 'Lightning Rod',
  balance: {
    effects: [
      { name: 'Lightning Rod', type: 'strike', coefficient: 1.5, hits: 1 },
      { type: 'condition', name: 'Lightning Rod', condition: 'Weakness', stacks: 1, duration: 4 }
    ]
  }
});

export const stormsoul = defineTrait({
  id: TRAIT.STORMSOUL,
  name: 'Stormsoul',
  modifierRules: [
    {
      order: -8,
      id: 'elementalist.stormsoul',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.07,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

export const boltToTheHeart = defineTrait({
  id: TRAIT.BOLT_TO_THE_HEART,
  name: 'Bolt to the Heart',
  modifierRules: [
    {
      order: -6,
      id: 'elementalist.bolt-to-the-heart',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.2,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && targetHealthBelow(context, 0.5)
    }
  ]
});
