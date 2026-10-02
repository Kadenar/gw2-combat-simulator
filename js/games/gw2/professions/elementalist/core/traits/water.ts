import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { primaryAttunement } from '#gw2/professions/elementalist/core/mechanics/modifier-queries.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';

/** Water definitions keep active tuning beside their behavior; explicit calls preserve mechanic ordering. */
export const soothingIce = defineTrait({
  id: TRAIT.SOOTHING_ICE,
  name: 'Soothing Ice',
  balance: {
    internalCooldown: 15,
    effects: [
      { type: 'buff', name: 'Frost Aura', kind: 'Frost Aura', stacks: 1, duration: 4 },
      { type: 'boon', name: 'Regeneration', boon: 'regeneration', stacks: 1, duration: 4 }
    ]
  }
});

export const aquamancersTraining = defineTrait({
  id: TRAIT.AQUAMANCERS_TRAINING,
  name: "Aquamancer's Training",
  balance: {
    rechargeMultiplier: 0.8
  }
});

export const soothingPower = defineTrait({
  id: TRAIT.SOOTHING_POWER,
  name: 'Soothing Power',
  balance: { attributeBonus: 300 },
  buildAttributes: traitAttributeEffects(TRAIT.SOOTHING_POWER, [
    { kind: 'flat', to: 'Vitality', field: 'attributeBonus', feedsConversions: false }
  ])
});

export const flowLikeWater = defineTrait({
  id: TRAIT.FLOW_LIKE_WATER,
  name: 'Flow like Water',
  modifierRules: [
    {
      order: -7,
      id: 'elementalist.flow-like-water',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.1,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});

export const piercingShards = defineTrait({
  id: TRAIT.PIERCING_SHARDS,
  name: 'Piercing Shards',
  modifierRules: [
    {
      order: -5,
      id: 'elementalist.piercing-shards',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      parameters: { waterFactor: 1.14, otherFactor: 1.07 },
      factor: (context, _target, parameters) =>
        primaryAttunement(context) === 'Water' ? parameters.waterFactor : parameters.otherFactor,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && targetConditionActive(context, 'Vulnerability')
    }
  ]
});
