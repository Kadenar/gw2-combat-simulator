import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionActive, targetHealthFraction } from '#gw2/platform/combat/query/runtime-query.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { warriorActiveBoonCount } from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { EMPOWER_PULSE, empowerPulse } from '#gw2/professions/warrior/core/traits/behavior.js';

/** Convert Power to Healing Power once, preserving the build's existing conversion pool. */
export const vigorousShouts = defineTrait({
  id: TRAIT.VIGOROUS_SHOUTS,
  name: 'Vigorous Shouts',
  balance: { attributeConversion: 0.13 },
  buildAttributes: traitAttributeEffects(TRAIT.VIGOROUS_SHOUTS, [
    {
      kind: 'conversion',
      from: 'Power',
      to: 'Healing Power',
      field: 'attributeConversion',
      rounding: 'none',
      input: 'eligible'
    }
  ]),
  modifierRules: [
    {
      id: 'warrior.vigorous-shouts-healing-power',
      target: MODIFIER_TARGET.ATTRIBUTE_HEALING_POWER,
      operation: 'add',
      amount: (context) =>
        (context.config?.stats?.power || 0) *
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.VIGOROUS_SHOUTS), 'attributeConversion'),
      when: (context) => !professionStaticRulesApplied(context.config)
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const legSpecialist = defineTrait({
  id: TRAIT.LEG_SPECIALIST,
  name: 'Leg Specialist',
  balance: {
    effects: [{ name: 'Immobilized', type: 'condition', condition: 'Immobilized', stacks: 1, duration: 1 }]
  },
  modifierRules: [
    {
      id: 'warrior.leg-specialist',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.05,
      order: 91,
      when: (context) =>
        ['Crippled', 'Chilled', 'Immobilized'].some((condition) => targetConditionActive(context, condition))
    }
  ],
  triggers: [
    {
      order: 8,

      on: 'condition.applied',
      when: (_runtime, event) => event.condition === 'Crippled',
      emit: TRAIT.LEG_SPECIALIST,
      attribution: { priority: 5 }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const marchingOrders = defineTrait({
  id: TRAIT.MARCHING_ORDERS,
  name: 'Marching Orders',
  balance: {
    internalCooldown: 10,
    effects: [{ name: 'might', type: 'boon', boon: 'might', stacks: 3, duration: 15 }]
  }
});

/** Owns this trait's tuning and selected contributions. */
export const soldiersComfort = defineTrait({
  id: TRAIT.SOLDIERS_COMFORT,
  name: "Soldier's Comfort",
  balance: {
    effects: [{ name: 'protection', type: 'boon', boon: 'protection', stacks: 1, duration: 4 }]
  }
});

/** Owns this trait's tuning and selected contributions. */
export const martialCadence = defineTrait({
  id: TRAIT.MARTIAL_CADENCE,
  name: 'Martial Cadence',
  balance: {
    effects: [{ name: 'stability', type: 'boon', boon: 'stability', stacks: 1, duration: 3 }]
  }
});

/** Owns this trait's tuning and selected contributions. */
export const empowerAllies = defineTrait({
  id: TRAIT.EMPOWER_ALLIES,
  name: 'Empower Allies',
  balance: {
    pulseInterval: 10,
    effects: [{ name: 'might', type: 'boon', boon: 'might', stacks: 5, duration: 10 }]
  },
  hooks: { tasks: { [EMPOWER_PULSE]: empowerPulse } }
});

/** Owns this trait's tuning and selected contributions. */
export const roaringReveille = defineTrait({
  id: TRAIT.ROARING_REVEILLE,
  name: 'Roaring Reveille',
  balance: {
    attributeBonus: 120
  },
  buildAttributes(_common, context) {
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Concentration',
          amount: balanceProfileNumber(
            requireBalanceProfileFromContext(context.balanceContext, TRAIT.ROARING_REVEILLE),
            'attributeBonus'
          ),
          feedsConversions: false,
          enabled: true
        }
      ]
    };
  }
});

/** Owns this trait's tuning and selected contributions. */
export const empowered = defineTrait({
  id: TRAIT.EMPOWERED,
  name: 'Empowered',
  modifierRules: [
    {
      id: 'warrior.empowered',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      parameters: { damagePerBoon: 0.01 },
      factor: (context, _target, parameters) => 1 + warriorActiveBoonCount(context) * parameters.damagePerBoon,
      order: 90
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const warriorsCunning = defineTrait({
  id: TRAIT.WARRIORS_CUNNING,
  name: "Warrior's Cunning",
  modifierRules: [
    {
      id: 'warrior.warriors-cunning',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.25,
      order: 92,
      when: (context) => targetHealthFraction(context) > 0.8
    }
  ]
});
