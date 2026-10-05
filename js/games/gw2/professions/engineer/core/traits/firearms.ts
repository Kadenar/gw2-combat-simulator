import { buffActive } from '#gw2/platform/combat/query/runtime-query.js';
import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import type { EngineerBuild } from '#gw2/professions/engineer/types.js';
import { activeBoonStacks, targetConditionCount } from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { heavyMetalBonus } from '#gw2/professions/engineer/core/traits/behavior.js';

/** Owns Serrated Steel tuning and behavior at its established runtime and build boundaries. */
export const serratedSteel = defineTrait({
  id: TRAIT.SERRATED_STEEL,
  name: 'Serrated Steel',
  balance: {
    procRate: {
      id: 'engineer.serrated-steel',
      traitId: TRAIT.SERRATED_STEEL,
      field: 'procChance',
      opportunity: 'eligible critical hit'
    },
    procChance: 0.33,
    durationMultiplier: 0.33,
    effects: [{ name: 'Bleeding', type: 'condition', condition: 'Bleeding', stacks: 1, duration: 3 }]
  },
  modifierRules: [
    {
      order: -7,
      id: 'engineer.serrated-steel-duration',
      target: MODIFIER_TARGET.CONDITION_DURATION,
      operation: 'add',

      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SERRATED_STEEL), 'durationMultiplier'),
      // Panel-derived simulation stats already contain this static bonus; provenance keeps direct simulations compatible.
      when: (context) => context.condition === 'Bleeding' && !professionStaticRulesApplied(context.config)
    }
  ],
  buildAttributes: (_common, { balanceContext }) => ({
    traitDurations: {
      'Bleeding Duration':
        100 *
        balanceProfileNumber(
          requireBalanceProfileFromContext(balanceContext, TRAIT.SERRATED_STEEL),
          'durationMultiplier'
        )
    }
  })
});

/** Owns No Scope tuning and behavior at its established runtime and build boundaries. */
export const noScope = defineTrait({
  id: TRAIT.NO_SCOPE,
  name: 'No Scope',
  balance: {
    internalCooldown: 8,
    attributeBonus: 150,
    effects: [{ name: 'fury', type: 'boon', boon: 'fury', stacks: 1, duration: 4 }]
  },
  buildAttributes: (_common, { balanceContext: profileContext, build }) => {
    const engineerBuild = build as EngineerBuild;
    const noScopeProfile = requireBalanceProfileFromContext(profileContext, TRAIT.NO_SCOPE);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Ferocity',
          amount: balanceProfileNumber(noScopeProfile, 'attributeBonus'),
          feedsConversions: false,
          enabled: engineerBuild.assumptions?.fury !== false
        }
      ]
    };
  }
});

/** Owns Incendiary Powder tuning and behavior at its established runtime and build boundaries. */
export const incendiaryPowder = defineTrait({
  id: TRAIT.INCENDIARY_POWDER,
  name: 'Incendiary Powder',
  balance: {
    internalCooldown: 10,
    durationMultiplier: 0.33,
    effects: [{ name: 'Burning', type: 'condition', condition: 'Burning', stacks: 1, duration: 8 }]
  },
  modifierRules: [
    {
      order: -6,
      id: 'engineer.incendiary-powder-duration',
      target: MODIFIER_TARGET.CONDITION_DURATION,
      operation: 'add',

      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.INCENDIARY_POWDER), 'durationMultiplier'),
      when: (context) => context.condition === 'Burning' && !professionStaticRulesApplied(context.config)
    }
  ],
  buildAttributes: (_common, { balanceContext }) => ({
    traitDurations: {
      'Burning Duration':
        100 *
        balanceProfileNumber(
          requireBalanceProfileFromContext(balanceContext, TRAIT.INCENDIARY_POWDER),
          'durationMultiplier'
        )
    }
  })
});

/** Owns Thermal Vision tuning and behavior at its established runtime and build boundaries. */
export const thermalVision = defineTrait({
  id: TRAIT.THERMAL_VISION,
  name: 'Thermal Vision',
  balance: {
    attributeBonus: 150,
    effects: [{ name: 'thermal-vision', type: 'buff', kind: 'thermal-vision', stacks: 1, duration: 4 }]
  },
  modifierRules: [
    {
      order: -8,
      // Accepted Burning-triggered buff windows own the modifier lifetime.
      id: 'engineer.thermal-vision-damage',
      conditionSampleInvariant: true,
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      amount: 0.05,
      when: (context) => buffActive(context, 'thermal-vision')
    }
  ],
  buildAttributes: traitAttributeEffects(TRAIT.THERMAL_VISION, [
    { kind: 'flat', to: 'Expertise', field: 'attributeBonus', feedsConversions: true }
  ])
});

/** Owns Sanguine Array tuning and behavior at its established runtime and build boundaries. */
export const sanguineArray = defineTrait({
  id: TRAIT.SANGUINE_ARRAY,
  name: 'Sanguine Array',
  balance: {
    effects: [{ name: 'might', type: 'boon', boon: 'might', stacks: 1, duration: 4 }]
  }
});

/** Owns Hematic Focus tuning and behavior at its established runtime and build boundaries. */
export const hematicFocus = defineTrait({
  id: TRAIT.HEMATIC_FOCUS,
  name: 'Hematic Focus',
  balance: {
    criticalChance: 0.15,
    internalCooldown: 8,
    effects: [{ name: 'fury', type: 'boon', boon: 'fury', stacks: 1, duration: 8 }]
  },
  modifierRules: [
    {
      order: -5,
      id: 'engineer.hematic-focus',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.HEMATIC_FOCUS), 'criticalChance'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && activeBoonStacks(context, 'fury', 1) > 0
    }
  ]
});

/** Owns Chemical Rounds tuning and behavior at its established runtime and build boundaries. */
export const chemicalRounds = defineTrait({
  id: TRAIT.CHEMICAL_ROUNDS,
  name: 'Chemical Rounds',
  balance: {
    conditionDurationMultiplier: 4 / 3,
    attributeBonus: 120
  },
  buildAttributes: traitAttributeEffects(TRAIT.CHEMICAL_ROUNDS, [
    { kind: 'flat', to: 'Condition Damage', field: 'attributeBonus', feedsConversions: true }
  ])
});

/** Owns High Caliber tuning and behavior at its established runtime and build boundaries. */
export const highCaliber = defineTrait({
  id: TRAIT.HIGH_CALIBER,
  name: 'High Caliber',
  balance: {
    criticalChance: 0.15
  },
  modifierRules: [
    {
      order: -13,
      id: 'engineer.high-caliber',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.HIGH_CALIBER), 'criticalChance'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

/** Owns Heavy Metal tuning and behavior at its established runtime and build boundaries. */
export const heavyMetal = defineTrait({
  id: TRAIT.HEAVY_METAL,
  name: 'Heavy Metal',
  balance: {
    lowerThreshold: 0.25,
    middleThreshold: 0.5,
    upperThreshold: 0.75,
    lowerBonus: 0.15,
    middleBonus: 0.1,
    upperBonus: 0.05
  },
  modifierRules: [
    {
      order: -11,
      id: 'engineer.heavy-metal-critical-chance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',

      amount: (context) => heavyMetalBonus(context),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    },
    {
      order: -10,
      id: 'engineer.heavy-metal-critical-damage',
      target: MODIFIER_TARGET.CRITICAL_DAMAGE,
      operation: 'multiply',

      factor: (context) => 1 + heavyMetalBonus(context),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

/** Owns Sharpshooter tuning and behavior at its established runtime and build boundaries. */
export const sharpshooter = defineTrait({
  id: TRAIT.SHARPSHOOTER,
  name: 'Sharpshooter',
  balance: {
    coefficientMultiplier: 2 / 3
  }
});

/** Owns Modified Ammunition tuning and behavior at its established runtime and build boundaries. */
export const modifiedAmmunition = defineTrait({
  id: TRAIT.MODIFIED_AMMUNITION,
  name: 'Modified Ammunition',
  modifierRules: [
    {
      order: -17,
      id: 'engineer.modified-ammunition',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      parameters: {
        damagePerCondition: 0.01
      },
      factor: (context, _target, parameters) => 1 + targetConditionCount(context) * parameters.damagePerCondition,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});
