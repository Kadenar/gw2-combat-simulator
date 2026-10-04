import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { elementalistTimedBuffStacks } from '#gw2/professions/elementalist/core/mechanics/modifier-queries.js';
import {
  extendPersistingFlamesEffects,
  extendPersistingFlamesFields
} from '#gw2/professions/elementalist/core/traits/persisting-flames.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/** Fire definitions keep active tuning beside their behavior; explicit calls preserve mechanic ordering. */
export const empoweringFlame = defineTrait({
  id: TRAIT.EMPOWERING_FLAME,
  name: 'Empowering Flame',
  balance: { attributeBonus: 150 }
});

export const inferno = defineTrait({
  id: TRAIT.INFERNO,
  name: 'Inferno',
  balance: { coefficientMultiplier: 0.0825 / 0.155 }
});

export const burningPrecision = defineTrait({
  id: TRAIT.BURNING_PRECISION,
  name: 'Burning Precision',
  balance: {
    procRate: {
      id: 'elementalist.burning-precision',
      traitId: TRAIT.BURNING_PRECISION,
      field: 'procChance',
      opportunity: 'eligible critical hit'
    },
    procChance: 0.33,
    internalCooldown: 5,
    durationMultiplier: 20,
    effects: [{ type: 'condition', name: 'Burning Precision', condition: 'Burning', stacks: 1, duration: 3 }]
  },
  buildAttributes: (_common, { balanceContext }) => ({
    traitDurations: {
      'Burning Duration': balanceProfileNumber(
        requireBalanceProfileFromContext(balanceContext, TRAIT.BURNING_PRECISION),
        'durationMultiplier'
      )
    }
  })
});

export const conjurer = defineTrait({
  id: TRAIT.CONJURER,
  name: 'Conjurer',
  balance: {
    effects: [{ type: 'buff', name: 'Conjurer', kind: 'Fire Aura', stacks: 1, duration: 4 }]
  }
});

export const sunspot = defineTrait({
  id: TRAIT.SUNSPOT,
  name: 'Sunspot',
  balance: {
    effects: [
      { type: 'buff', name: 'Sunspot Aura', kind: 'Fire Aura', stacks: 1, duration: 3 },
      { type: 'strike', name: 'Sunspot', coefficient: 0.6, hits: 1 }
    ]
  }
});

export const burningRage = defineTrait({
  id: TRAIT.BURNING_RAGE,
  name: 'Burning Rage',
  balance: {
    // The replacement burning belongs to Sunspot's shared trigger.
    damagePreviewAttribution: 'shared',
    attributeBonus: 180,
    durationMultiplier: 20,
    effects: [{ type: 'condition', name: 'Sunspot Burning', condition: 'Burning', stacks: 2, duration: 4 }]
  },
  buildAttributes: traitAttributeEffects(TRAIT.BURNING_RAGE, [
    { kind: 'flat', to: 'Condition Damage', field: 'attributeBonus', feedsConversions: false }
  ])
});

export const smotheringAuras = defineTrait({
  id: TRAIT.SMOTHERING_AURAS,
  name: 'Smothering Auras',
  balance: { durationMultiplier: 1.33 }
});

export const powerOverwhelming = defineTrait({
  id: TRAIT.POWER_OVERWHELMING,
  name: 'Power Overwhelming',
  balance: {
    minimumStacks: 10,
    attributeBonus: 150,
    weaponAttributeBonus: 300
  }
});

export const pyromancersTraining = defineTrait({
  id: TRAIT.PYROMANCERS_TRAINING,
  name: "Pyromancer's Training",
  balance: {
    rechargeMultiplier: 0.8
  },
  modifierRules: [
    {
      order: -10,
      id: 'elementalist.pyromancers-training',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.07,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && targetConditionActive(context, 'Burning')
    }
  ]
});

export const pyromancersPuissance = defineTrait({
  id: TRAIT.PYROMANCERS_PUISSANCE,
  name: "Pyromancer's Puissance",
  balance: {
    // Measured Fire-exit-to-impact delay, separate from the instant attunement swap.
    initialDelay: 0.68,
    maximumStacks: 10,
    damageIncreasePerStack: 0.1,
    durationPerTier: 0.5,
    effects: [
      { type: 'boon', name: 'Attunement Might', boon: 'might', stacks: 1, duration: 15 },
      { type: 'boon', name: 'Flame Expulsion Might', boon: 'might', stacks: 1, duration: 15 },
      { type: 'strike', name: 'Flame Expulsion', coefficient: 1, hits: 1 },
      { type: 'condition', name: 'Flame Expulsion', condition: 'Burning', stacks: 1, duration: 2 }
    ]
  }
});

/** Own field extensions, stack lifetime, and damage tuning while keeping ordered resolver calls explicit. */
export const persistingFlames = defineTrait({
  id: TRAIT.PERSISTING_FLAMES,
  name: 'Persisting Flames',
  balance: { durationMultiplier: 15, durationPerTier: 2, summons: 2, maximumStacks: 5 },
  modifierRules: [
    {
      id: 'elementalist.persisting-flames',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      order: -11,
      parameters: { damagePerStack: 0.02 },
      amount: (context, _target, parameters) =>
        elementalistTimedBuffStacks(
          context,
          'persisting flames',
          balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.PERSISTING_FLAMES), 'maximumStacks')
        ) * parameters.damagePerStack
    }
  ],
  hooks: {
    modifyEffects: (runtime: ElementalistRuntime, cast, effects) =>
      extendPersistingFlamesEffects(runtime, cast.skill, effects),
    modifyComboFields: extendPersistingFlamesFields
  }
});
