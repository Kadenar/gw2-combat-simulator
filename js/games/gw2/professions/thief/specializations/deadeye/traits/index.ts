import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { eventSkill } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { markedTarget } from '#gw2/professions/thief/specializations/deadeye/skills/index.js';
import { activeBoonCount } from '#gw2/professions/thief/specializations/deadeye/traits/behavior.js';

/** Owns Be Quick or Be Killed tuning and behavior at the existing execution boundaries. */
export const beQuickOrBeKilled = defineTrait({
  id: TRAIT.BE_QUICK_OR_BE_KILLED,
  name: 'Be Quick or Be Killed',
  balance: {
    attributeBonus: 200,
    effects: [{ type: 'boon', name: 'Quickness', boon: 'Quickness', stacks: 1, duration: 4 }]
  }
});

/** Owns Fire for Effect tuning and behavior at the existing execution boundaries. */
export const fireForEffect = defineTrait({
  id: TRAIT.FIRE_FOR_EFFECT,
  name: 'Fire for Effect',
  balance: {
    effects: [
      { type: 'boon', name: 'Might', boon: 'Might', stacks: 8, duration: 12 },
      { type: 'boon', name: 'Fury', boon: 'Fury', stacks: 1, duration: 12 }
    ]
  }
});

/** Owns this trait's modifier eligibility. */
export const ironSight = defineTrait({
  id: TRAIT.IRON_SIGHT,
  name: 'Iron Sight',
  modifierRules: [
    {
      order: 203,
      id: 'thief.iron-sight',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.1,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && markedTarget(context)
    }
  ]
});

/** Owns Maleficent Seven tuning and behavior at the existing execution boundaries. */
export const maleficentSeven = defineTrait({
  id: TRAIT.MALEFICENT_SEVEN,
  name: 'Maleficent Seven',
  balance: {
    maximumStacks: 7,
    resourceGain: 7,
    effects: [
      { type: 'boon', name: 'Might', boon: 'Might', stacks: 10, duration: 10 },
      { type: 'boon', name: 'Fury', boon: 'Fury', stacks: 1, duration: 10 },
      { type: 'boon', name: 'Protection', boon: 'Protection', stacks: 1, duration: 5 },
      { type: 'boon', name: 'Regeneration', boon: 'Regeneration', stacks: 1, duration: 10 },
      { type: 'boon', name: 'Swiftness', boon: 'Swiftness', stacks: 1, duration: 10 },
      { type: 'boon', name: 'Vigor', boon: 'Vigor', stacks: 1, duration: 10 }
    ]
  }
});

/** Owns Malicious Intent tuning and behavior at the existing execution boundaries. */
export const maliciousIntent = defineTrait({
  id: TRAIT.MALICIOUS_INTENT,
  name: 'Malicious Intent',
  balance: {
    resourceGain: 2
  }
});

/** Owns this trait's modifier eligibility. */
export const oneInTheChamber = defineTrait({
  id: TRAIT.ONE_IN_THE_CHAMBER,
  name: 'One in the Chamber',
  modifierRules: [
    {
      order: 205,
      id: 'thief.one-in-the-chamber',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.25,
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        Boolean(eventSkill(context)?.categories?.includes('stolen skill'))
    }
  ]
});

/** Owns Premeditation tuning and behavior at the existing execution boundaries. */
export const premeditation = defineTrait({
  id: TRAIT.PREMEDITATION,
  name: 'Premeditation',
  modifierRules: [
    {
      order: 204,
      id: 'thief.premeditation',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      parameters: { damagePerBoon: 0.01 },
      factor: (context, _target, parameters) => 1 + activeBoonCount(context) * parameters.damagePerBoon,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ],
  balance: {
    attributeBonus: 180
  },
  buildAttributes(_common, { balanceContext }) {
    const premeditationProfile = requireBalanceProfileFromContext(balanceContext, TRAIT.PREMEDITATION);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Concentration',
          amount: balanceProfileNumber(premeditationProfile, 'attributeBonus'),
          feedsConversions: false
        }
      ]
    };
  }
});

/** Owns Silent Scope tuning and behavior at the existing execution boundaries. */
export const silentScope = defineTrait({
  id: TRAIT.SILENT_SCOPE,
  name: 'Silent Scope',
  balance: {
    threshold: 3,
    durationMultiplier: 3,
    attributeBonus: 120
  },
  buildAttributes(_common, { balanceContext }) {
    const silentScopeProfile = requireBalanceProfileFromContext(balanceContext, TRAIT.SILENT_SCOPE);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Precision',
          amount: balanceProfileNumber(silentScopeProfile, 'attributeBonus'),
          feedsConversions: true
        }
      ]
    };
  }
});

/** Native trait owners, in stable authoring order. */
export const deadeyeTraits = Object.freeze([
  maleficentSeven,
  maliciousIntent,
  beQuickOrBeKilled,
  fireForEffect,
  silentScope,
  premeditation,
  ironSight,
  oneInTheChamber
]);
