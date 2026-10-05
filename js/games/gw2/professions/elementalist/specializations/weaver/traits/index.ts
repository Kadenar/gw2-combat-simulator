import { activeBuffStacks, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';

import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { elementalistEventSkill } from '#gw2/professions/elementalist/core/mechanics/effects.js';

import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import { weaverDualAttunements } from '#gw2/professions/elementalist/specializations/weaver/mechanics/dual-weapon-state.js';
import { elementsOfRageAvailability } from '#gw2/professions/elementalist/specializations/weaver/traits/attunements.js';

export const elementalRefreshment = defineTrait({
  id: TRAIT.ELEMENTAL_REFRESHMENT,
  name: 'Elemental Refreshment',
  balance: { attributeBonus: 180 },
  buildAttributes: traitAttributeEffects(TRAIT.ELEMENTAL_REFRESHMENT, [
    { kind: 'flat', to: 'Vitality', field: 'attributeBonus', feedsConversions: false }
  ])
});

export const elementalPolyphony = defineTrait({
  id: TRAIT.ELEMENTAL_POLYPHONY,
  name: 'Elemental Polyphony',
  balance: {
    attributeBonus: 200
  }
});

export const superiorElements = defineTrait({
  id: TRAIT.SUPERIOR_ELEMENTS,
  name: 'Superior Elements',
  balance: {
    criticalChance: 0.2,
    internalCooldown: 4,
    effects: [
      {
        type: 'condition',
        name: 'Weakness',
        condition: 'Weakness',
        stacks: 1,
        duration: 5
      }
    ]
  },
  modifierRules: [
    {
      id: 'elementalist.superior-elements',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.SUPERIOR_ELEMENTS), 'criticalChance'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && targetConditionActive(context, 'Weakness')
    }
  ]
});

export const elementalPursuit = defineTrait({
  id: TRAIT.ELEMENTAL_PURSUIT,
  name: 'Elemental Pursuit',
  balance: {
    effects: [{ type: 'boon', name: 'Swiftness', boon: 'swiftness', stacks: 1, duration: 3 }]
  },
  triggers: [
    {
      emit: TRAIT.ELEMENTAL_PURSUIT,
      on: 'control.resolved',
      when: (_runtime, event) => event.type === 'control' && event.actorType === 'player',
      effects: (effect) => effect.type === 'boon' && effect.name === 'Swiftness',
      attribution: (runtime, event) => ({
        source: 'Elemental Pursuit',
        sourceId: event.skillId ?? event.sourceId,
        skillId: elementalistEventSkill(runtime, 'Elemental Pursuit', event.skillId ?? event.sourceId).id,
        skillName: 'Elemental Pursuit',
        actorType: 'player',
        name: 'Elemental Pursuit',
        priority: 0
      })
    }
  ]
});

export const weaversProwess = defineTrait({
  id: TRAIT.WEAVERS_PROWESS,
  name: "Weaver's Prowess",
  balance: {
    effects: [{ type: 'boon', name: 'Resistance', boon: 'resistance', stacks: 1, duration: 3 }]
  }
});

export const swiftRevenge = defineTrait({
  id: TRAIT.SWIFT_REVENGE,
  name: 'Swift Revenge',
  balance: {
    resourceGain: 25,
    effects: [
      { type: 'boon', name: 'Fire', boon: 'might', stacks: 3, duration: 5 },
      { type: 'boon', name: 'Air', boon: 'swiftness', stacks: 1, duration: 5 }
    ]
  }
});

export const bolsteredElements = defineTrait({
  id: TRAIT.BOLSTERED_ELEMENTS,
  name: 'Bolstered Elements',
  balance: {
    effects: [{ type: 'boon', name: 'Protection', boon: 'protection', stacks: 1, duration: 3 }]
  }
});

export const elementsOfRage = defineTrait({
  id: TRAIT.ELEMENTS_OF_RAGE,
  name: 'Elements of Rage',
  balance: {
    durationMultiplier: 8
  },
  modifierRules: [
    {
      id: 'elementalist.elements-of-rage-strike',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.15,
      when: (context) => activeBuffStacks(context, 'elements of rage', 1) > 0
    },
    {
      id: 'elementalist.elements-of-rage-condition',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      amount: 0.1,
      when: (context) => activeBuffStacks(context, 'elements of rage', 1) > 0
    }
  ],
  hooks: { availability: elementsOfRageAvailability }
});

export const flowState = defineTrait({
  id: TRAIT.FLOW_STATE,
  name: 'Flow State',
  balance: {
    rechargeReduction: 1, // flat seconds removed from attunement recharge
    rechargeMultiplier: 0.8 // fraction of dual-skill recharge retained
  },
  rechargeRules: [
    {
      when: (_context, skill) => String(skill.slot) === 'Weapon_3' && Boolean(weaverDualAttunements(skill)),
      multiplier: { profile: TRAIT.FLOW_STATE, field: 'rechargeMultiplier' }
    }
  ]
});
/** Register weaver traits in their existing execution order. */
export const weaverTraits = [
  elementalRefreshment,
  elementalPolyphony,
  superiorElements,
  elementalPursuit,
  weaversProwess,
  swiftRevenge,
  bolsteredElements,
  elementsOfRage,
  flowState
];
