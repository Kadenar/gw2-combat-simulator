import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { boonActive, playerHealthFraction, targetHealthFraction } from '#gw2/platform/combat/query/runtime-query.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { activeBuff } from '#gw2/professions/ranger/core/traits/modifier-queries.js';
import type { RangerModifierContext } from '#gw2/professions/ranger/types.js';

function oppressiveSuperiorityActive(context: RangerModifierContext): boolean {
  return (
    hasTrait(context, TRAIT.OPPRESSIVE_SUPERIORITY) && targetHealthFraction(context) < playerHealthFraction(context)
  );
}

/** Owns Unstoppable Union's live tuning and trait behavior. */
export const unstoppableUnion = defineTrait({
  id: TRAIT.UNSTOPPABLE_UNION,
  name: 'Unstoppable Union',
  balance: {
    effects: [{ name: 'protection', type: 'boon', boon: 'protection', duration: 2.5, stacks: 1 }]
  }
});

/** Owns Leader of the Pack's live tuning and trait behavior. */
export const leaderOfThePack = defineTrait({
  id: TRAIT.LEADER_OF_THE_PACK,
  name: 'Leader of the Pack',
  balance: {
    durationMultiplier: 1.2
  }
});

/** Owns Live Fast's live tuning and trait behavior. */
export const liveFast = defineTrait({
  id: TRAIT.LIVE_FAST,
  name: 'Live Fast',
  balance: {
    effects: [
      { name: 'fury', type: 'boon', boon: 'fury', duration: 6, stacks: 1 },
      { name: 'quickness', type: 'boon', boon: 'quickness', duration: 3, stacks: 1 }
    ]
  }
});

/** Owns Twice as Vicious's live tuning and trait behavior. */
export const twiceAsVicious = defineTrait({
  id: TRAIT.TWICE_AS_VICIOUS,
  name: 'Twice as Vicious',
  balance: {
    effects: [
      {
        name: 'twice-as-vicious',
        type: 'buff',
        kind: 'twice-as-vicious',
        duration: 10,
        stacks: 1
      }
    ]
  },
  modifierRules: [
    {
      order: 104,
      requiresSelection: false,
      id: 'ranger.twice-as-vicious-strike',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.07,
      when: (context) => activeBuff(context, 'twice-as-vicious')
    },
    {
      order: 105,
      requiresSelection: false,
      id: 'ranger.twice-as-vicious-condition',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      amount: 0.1,
      when: (context) => activeBuff(context, 'twice-as-vicious')
    }
  ],
  triggers: [
    {
      emit: TRAIT.TWICE_AS_VICIOUS,
      on: 'control.resolved',

      // Removing the active profile's buff disables the control proc.
      when: (runtime) =>
        Boolean(
          requireEffect(requireBalanceProfileFromContext(runtime, TRAIT.TWICE_AS_VICIOUS), 'buff', 'twice-as-vicious')
        ),
      effects: (effect) => (effect.type === 'boon' || effect.type === 'buff') && effect.name === 'twice-as-vicious',
      attribution: (_runtime, event) => ({
        skillId: TRAIT.TWICE_AS_VICIOUS,
        skillName: 'Twice as Vicious',
        name: 'Twice as Vicious',
        triggeredBy: event.skillName,
        ...(event.metadata?.triggeredByAlly
          ? {
              audience: {
                recipients: 'party' as const,
                alliedPlayerIndex: event.metadata.triggeredByAlly,
                affectsSelf: false,
                maximumRecipients: 1,
                eligibleCompanionIds: []
              },
              metadata: { triggeredByAlly: event.metadata.triggeredByAlly }
            }
          : {})
      })
    }
  ]
});

/** Owns Predator's Cunning's live tuning and trait behavior. */
export const predatorsCunning = defineTrait({
  id: TRAIT.PREDATORS_CUNNING,
  name: "Predator's Cunning",
  balance: {
    effects: [{ name: 'Strike', type: 'strike', coefficient: 0.006, hits: 1, canCrit: false }]
  },
  triggers: [
    {
      emit: TRAIT.PREDATORS_CUNNING,
      on: 'condition.applied',
      when: (_runtime, event) => event.condition === 'Poisoned',
      effects: (effect) => effect.type === 'strike' && effect.name === 'Strike',
      attribution: (_runtime, event) => ({
        skillId: TRAIT.PREDATORS_CUNNING,
        skillName: "Predator's Cunning",
        name: "Predator's Cunning",
        skillWeapon: 'Unequipped',
        triggeredBy: event.skillName
      })
    }
  ]
});

/** Owns Oppressive Superiority's live tuning and trait behavior. */
export const oppressiveSuperiority = defineTrait({
  id: TRAIT.OPPRESSIVE_SUPERIORITY,
  name: 'Oppressive Superiority',
  balance: {
    conditionDurationBonus: 0.1
  },
  modifierRules: [
    {
      order: 106,
      id: 'ranger.oppressive-superiority',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.1,
      when: oppressiveSuperiorityActive
    },
    {
      order: 107,
      id: 'ranger.oppressive-superiority-condition-duration',
      target: MODIFIER_TARGET.CONDITION_DURATION,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.OPPRESSIVE_SUPERIORITY),
          'conditionDurationBonus'
        ),
      when: oppressiveSuperiorityActive
    }
  ]
});

/** Owns Essence of Speed's live tuning and trait behavior. */
export const essenceOfSpeed = defineTrait({
  id: TRAIT.ESSENCE_OF_SPEED,
  name: 'Essence of Speed',
  balance: {
    internalCooldown: 5,
    durationMultiplier: 2
  }
});

/** Owns Furious Strength's live tuning and trait behavior. */
export const furiousStrength = defineTrait({
  id: TRAIT.FURIOUS_STRENGTH,
  name: 'Furious Strength',
  modifierRules: [
    {
      order: 101,
      id: 'ranger.furious-strength',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.15,
      // Furious Strength requires the player to have Fury; pet fury does not count.
      when: (context) => boonActive(context, 'fury')
    }
  ]
});

/** Register authored owners in a fixed order; runtime boundaries stay explicit. */
export const soulbeastTraits = [
  unstoppableUnion,
  leaderOfThePack,
  liveFast,
  twiceAsVicious,
  predatorsCunning,
  oppressiveSuperiority,
  essenceOfSpeed,
  furiousStrength
];
