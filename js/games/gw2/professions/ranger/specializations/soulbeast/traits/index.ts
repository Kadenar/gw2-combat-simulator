import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { boonActive, playerHealthFraction, targetHealthFraction } from '#gw2/platform/combat/query/runtime-query.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';

import { mergedBeastHit } from '#gw2/professions/ranger/core/mechanics/combat.js';
import { rangerBuffRequest } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { activeBuff } from '#gw2/professions/ranger/core/traits/modifier-queries.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { beastmodeChanged } from '#gw2/professions/ranger/specializations/soulbeast/skills/beastmode-skills.js';
import type {
  RangerModifierContext,
  RangerResolverContext,
  RangerRuntime,
  RangerSkill
} from '#gw2/professions/ranger/types.js';

function oppressiveSuperiorityActive(context: RangerModifierContext): boolean {
  // Registration gates selection; the remaining condition compares player and target health.
  return targetHealthFraction(context) < playerHealthFraction(context);
}

/** Owns Unstoppable Union's live tuning and trait behavior. */
export const unstoppableUnion = defineTrait({
  triggers: [
    onTriggerPoint(beastmodeChanged, {
      run: (runtime, input: TriggerPointInput<typeof beastmodeChanged>) => applyUnstoppableUnion(runtime, input.skill)
    })
  ],
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
    durationMultiplier: 1.2,
    sharedDurationMultiplier: 0.5
  }
});

/** Owns Live Fast's live tuning and trait behavior. */
export const liveFast = defineTrait({
  triggers: [
    onTriggerPoint(mergedBeastHit, {
      run: (runtime, input: TriggerPointInput<typeof mergedBeastHit>) => triggerMergedLiveFast(runtime, input.event)
    })
  ],
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
    damageIncrease: 0.07,
    conditionDamageIncrease: 0.1,
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
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.TWICE_AS_VICIOUS), 'damageIncrease'),
      when: (context) => activeBuff(context, 'twice-as-vicious')
    },
    {
      order: 105,
      requiresSelection: false,
      id: 'ranger.twice-as-vicious-condition',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      amount: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.TWICE_AS_VICIOUS),
          'conditionDamageIncrease'
        ),
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
    // Resolve and display the siphon separately, using base damage plus Power without weapon or armor scaling.
    effects: [
      {
        name: 'Strike',
        type: 'strike',
        coefficient: 0,
        flatStrikeBase: 170,
        flatStrikePowerCoeff: 0.006,
        damageBreakdownName: "Life Siphon - Predator's Cunning",
        hits: 1,
        canCrit: false,
        damageKind: 'life-steal'
      }
    ]
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
    damageMultiplier: 1.1,
    conditionDurationBonus: 0.1
  },
  modifierRules: [
    {
      order: 106,
      id: 'ranger.oppressive-superiority',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.OPPRESSIVE_SUPERIORITY),
          'damageMultiplier'
        ),
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
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageIncrease: 0.15 },
  modifierRules: [
    {
      order: 101,
      id: 'ranger.furious-strength',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FURIOUS_STRENGTH), 'damageIncrease'),
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

/** Runs once on the accepted first hit of the merged Beast ability. */
function triggerMergedLiveFast(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  {
    const profile = requireBalanceProfileFromContext(context, TRAIT.LIVE_FAST);
    const fury = requireEffect(profile, 'boon', 'fury');
    const quickness = requireEffect(profile, 'boon', 'quickness');
    if (fury) context.effects.emit(rangerBuffRequest(event, profile, fury, 'Live Fast', TRAIT.LIVE_FAST));
    if (quickness) context.effects.emit(rangerBuffRequest(event, profile, quickness, 'Live Fast', TRAIT.LIVE_FAST));
  }
}

// Called from both enter- and exit-beastmode handlers; protection fires on every toggle regardless of direction.
function applyUnstoppableUnion(context: RangerRuntime, skill: RangerSkill): void {
  const profile = requireBalanceProfileFromContext(context, TRAIT.UNSTOPPABLE_UNION);
  const effect = requireEffect(profile, 'boon', 'protection');
  if (!effect) return;
  emitTraitProfile(context, TRAIT.UNSTOPPABLE_UNION, TRAIT.UNSTOPPABLE_UNION, undefined, {
    at: context.time,
    fullEnd: context.time,
    effect: { type: 'boon', name: 'protection' },
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.UNSTOPPABLE_UNION,
      actorType: 'effect',
      skillId: skill.id,
      skillName: 'Unstoppable Union',
      name: 'Unstoppable Union'
    }
  });
}
