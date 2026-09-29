import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionCount, targetHealthBelow } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

/** Owns Dagger Training tuning and behavior at the existing execution boundaries. */
export const daggerTraining = defineTrait({
  id: TRAIT.DAGGER_TRAINING,
  name: 'Dagger Training',
  balance: { attributeBonus: 80, weaponAttributeBonus: 160 },
  buildAttributes(_common, { build, weaponSet, balanceContext }) {
    const weapons = (weaponSet === 2 ? build.alternateWeapons : build.weapons) || [];
    const daggerTrainingProfile = requireBalanceProfileFromContext(balanceContext, TRAIT.DAGGER_TRAINING);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          source: 'Dagger Training',
          to: 'Power',
          amount: balanceProfileNumber(
            daggerTrainingProfile,
            weapons.includes('Dagger') ? 'weaponAttributeBonus' : 'attributeBonus'
          ),
          feedsConversions: true
        }
      ]
    };
  }
});

/** Owns Deadly Ambition tuning and behavior at the existing execution boundaries. */
export const deadlyAmbition = defineTrait({
  id: TRAIT.DEADLY_AMBITION,
  name: 'Deadly Ambition',
  balance: {
    attributeBonus: 180,
    playerStacks: 2,
    effects: [{ type: 'condition', name: 'Poisoned', condition: 'Poisoned', stacks: 1, duration: 3 }]
  },
  buildAttributes(_common, { balanceContext }) {
    const deadlyAmbitionProfile = requireBalanceProfileFromContext(balanceContext, TRAIT.DEADLY_AMBITION);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          source: 'Deadly Ambition',
          to: 'Condition Damage',
          amount: balanceProfileNumber(deadlyAmbitionProfile, 'attributeBonus'),
          feedsConversions: true
        }
      ]
    };
  }
});

/** Owns Even the Odds tuning and behavior at the existing execution boundaries. */
export const evenTheOdds = defineTrait({
  id: TRAIT.EVEN_THE_ODDS,
  name: 'Even the Odds',
  balance: {
    effects: [
      {
        type: 'condition',
        name: 'Vulnerability',
        condition: 'Vulnerability',
        stacks: 10,
        duration: 10
      }
    ]
  }
});

/** Owns this trait's modifier eligibility. */
export const executioner = defineTrait({
  id: TRAIT.EXECUTIONER,
  name: 'Executioner',
  modifierRules: [
    {
      order: 2,
      id: 'thief.executioner',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.2,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && targetHealthBelow(context, 0.5)
    }
  ]
});

/** Owns this trait's modifier eligibility. */
export const exposedWeakness = defineTrait({
  id: TRAIT.EXPOSED_WEAKNESS,
  name: 'Exposed Weakness',
  modifierRules: [
    {
      order: 1,
      id: 'thief.exposed-weakness',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      parameters: {
        damagePerCondition: 0.02
      },
      factor: (context, _target, parameters) => 1 + targetConditionCount(context) * parameters.damagePerCondition,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

/** Owns Improvisation tuning and behavior at the existing execution boundaries. */
export const improvisation = defineTrait({
  id: TRAIT.IMPROVISATION,
  name: 'Improvisation',
  balance: {
    maximumStacks: 2,
    internalCooldown: 15,
    rechargeMultiplier: 0.75,
    resourceGain: 1,
    lifeForceGain: 1
  }
});

/** Owns Lotus Poison tuning and behavior at the existing execution boundaries. */
export const lotusPoison = defineTrait({
  id: TRAIT.LOTUS_POISON,
  name: 'Lotus Poison',
  balance: {
    internalCooldown: 10,
    effects: [
      { type: 'boon', name: 'Might', boon: 'Might', stacks: 3, duration: 10, audience: { recipients: 'self' } },
      { type: 'condition', name: 'Weakness', condition: 'Weakness', stacks: 1, duration: 4 }
    ]
  }
});

/** Owns Mug tuning and behavior at the existing execution boundaries. */
export const mug = defineTrait({
  id: TRAIT.MUG,
  name: 'Mug',
  balance: {
    effects: [{ type: 'strike', name: 'Mug', coefficient: 1.5, hits: 1 }]
  }
});

/** Owns Panic Strike tuning and behavior at the existing execution boundaries. */
export const panicStrike = defineTrait({
  id: TRAIT.PANIC_STRIKE,
  name: 'Panic Strike',
  balance: {
    threshold: 3,
    internalCooldown: 20,
    playerStacks: 2,
    effects: [
      {
        type: 'condition',
        name: 'Immobilized',
        condition: 'Immobilized',
        stacks: 1,
        duration: 2.5
      },
      { type: 'condition', name: 'Poisoned', condition: 'Poisoned', stacks: 1, duration: 4 }
    ]
  }
});

/** Owns Potent Poison tuning and behavior at the existing execution boundaries. */
export const potentPoison = defineTrait({
  id: TRAIT.POTENT_POISON,
  name: 'Potent Poison',
  modifierRules: [
    {
      order: 10,
      id: 'thief.potent-poison-damage',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: 1.33,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && context.event?.condition === 'Poisoned'
    },
    {
      order: 12,
      id: 'thief.potent-poison-duration',
      target: MODIFIER_TARGET.CONDITION_DURATION,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.POTENT_POISON), 'conditionDurationBonus'),
      // Specific condition-duration bonuses add to Expertise and are skipped when panel stats already include them.
      when: (context) => context.event?.condition === 'Poisoned' && !professionStaticRulesApplied(context.config)
    }
  ],
  balance: {
    conditionDurationBonus: 0.33
  },
  buildAttributes(_common, { balanceContext }) {
    const profile = requireBalanceProfileFromContext(balanceContext, TRAIT.POTENT_POISON);
    return { traitDurations: { 'Poison Duration': 100 * balanceProfileNumber(profile, 'conditionDurationBonus') } };
  }
});

/** Owns Revealed Training tuning and behavior at the existing execution boundaries. */
export const revealedTraining = defineTrait({
  id: TRAIT.REVEALED_TRAINING,
  name: 'Revealed Training',
  balance: {
    attributeBonus: 80,
    attributePerStack: 120
  },
  buildAttributes(_common, { balanceContext }) {
    const revealedTrainingProfile = requireBalanceProfileFromContext(balanceContext, TRAIT.REVEALED_TRAINING);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          source: 'Revealed Training',
          to: 'Power',
          amount: balanceProfileNumber(revealedTrainingProfile, 'attributeBonus'),
          feedsConversions: false
        }
      ]
    };
  }
});

/** Owns Serpent's Touch tuning and behavior at the existing execution boundaries. */
export const serpentsTouch = defineTrait({
  id: TRAIT.SERPENTS_TOUCH,
  name: "Serpent's Touch",
  balance: {
    playerStacks: 3,
    effects: [{ type: 'condition', name: 'Poisoned', condition: 'Poisoned', stacks: 2, duration: 10 }]
  }
});
