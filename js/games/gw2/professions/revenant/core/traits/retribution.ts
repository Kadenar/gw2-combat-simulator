import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { boonActive, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';

/** Owns Dwarven Battle Training tuning and behavior at its established execution boundaries. */
export const dwarvenBattleTraining = defineTrait({
  id: TRAIT.DWARVEN_BATTLE_TRAINING,
  name: 'Dwarven Battle Training',
  balance: {
    id: TRAIT.DWARVEN_BATTLE_TRAINING,
    categories: ['Trait'],
    skillFamily: 'Trait',
    effects: [
      {
        name: 'Weakness',
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 5,
        actorType: 'player'
      }
    ]
  },
  modifierRules: [
    {
      id: 'revenant.dwarven-battle-training',
      order: 3,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.1,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && targetConditionActive(context, 'Weakness')
    }
  ],
  triggers: [
    {
      on: 'control.resolved',
      when: () => true,
      emit: TRAIT.DWARVEN_BATTLE_TRAINING,
      effects: (effect) => effect.type === 'condition' && effect.name === 'Weakness',
      attribution: {
        source: 'revenant',
        sourceId: TRAIT.DWARVEN_BATTLE_TRAINING,
        actorType: 'player',
        skillId: TRAIT.DWARVEN_BATTLE_TRAINING,
        skillName: 'Dwarven Battle Training',
        name: 'Dwarven Battle Training — Weakness'
      }
    }
  ]
});

/** Owns Enduring Recovery tuning and behavior at its established execution boundaries. */
export const enduringRecovery = defineTrait({
  id: TRAIT.ENDURING_RECOVERY,
  name: 'Enduring Recovery',
  balance: {
    id: TRAIT.ENDURING_RECOVERY,
    enduranceRegenerationMultiplier: 1.25,
    effects: []
  }
});

/** Owns Versed in Stone tuning and behavior at its established execution boundaries. */
export const versedInStone = defineTrait({
  buildAttributes: (_common, { balanceContext }) => ({
    attributeEffects: [
      {
        kind: 'conversion',
        source: 'Versed in Stone',
        from: 'Toughness',
        to: 'Power',
        multiplier: balanceProfileNumber(
          requireBalanceProfileFromContext(balanceContext, TRAIT.VERSED_IN_STONE),
          'attributeConversion'
        ),
        rounding: 'round',
        input: 'common'
      }
    ]
  }),
  id: TRAIT.VERSED_IN_STONE,
  name: 'Versed in Stone',
  balance: { id: TRAIT.VERSED_IN_STONE, attributeConversion: 0.13 }
});

/** Owns Vicious Reprisal tuning and behavior at its established execution boundaries. */
export const viciousReprisalTrait = defineTrait({
  id: TRAIT.VICIOUS_REPRISAL,
  name: 'Vicious Reprisal',
  balance: {
    id: TRAIT.VICIOUS_REPRISAL,
    categories: ['Trait'],
    skillFamily: 'Trait',
    cooldown: 1,
    effects: [
      {
        name: 'might',
        type: 'boon',
        boon: 'might',
        duration: 10,
        stacks: 1,
        actorType: 'player'
      }
    ]
  },
  modifierRules: [
    {
      id: 'revenant.vicious-reprisal',
      order: 4,
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',
      amount: 0.1,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && boonActive(context, 'resolution')
    }
  ]
});
