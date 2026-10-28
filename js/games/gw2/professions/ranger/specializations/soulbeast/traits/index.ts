// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { boonKey } from '#gw2/platform/combat/boons.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { boonActive, playerHealthFraction, targetHealthFraction } from '#gw2/platform/combat/query/runtime-query.js';
import { ACTOR, BOON, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import {
  balanceNumberFromContext,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { rangerProfileEffectRequest } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { mergedBeastHit } from '#gw2/professions/ranger/core/mechanics/trigger-points.js';
import { activeBuff } from '#gw2/professions/ranger/core/traits/modifier-queries.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { beastmodeChanged } from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode-effects.js';
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
const unstoppableUnion = defineTrait({
  name: 'Unstoppable Union',
  id: TRAIT.UNSTOPPABLE_UNION,
  balance: {
    effects: [{ name: boonKey(BOON.PROTECTION), type: 'boon', boon: BOON.PROTECTION, duration: 2.5, stacks: 1 }]
  },
  triggers: [
    onTriggerPoint(beastmodeChanged, {
      run: (runtime, input: TriggerPointInput<typeof beastmodeChanged>) => applyUnstoppableUnion(runtime, input.skill)
    })
  ]
});

/** Owns Leader of the Pack's live tuning and trait behavior. */
const leaderOfThePack = defineTrait({
  name: 'Leader of the Pack',
  id: TRAIT.LEADER_OF_THE_PACK,
  balance: {
    durationMultiplier: 1.2,
    sharedDurationMultiplier: 0.5
  }
});

/** Owns Live Fast's live tuning and trait behavior. */
const liveFast = defineTrait({
  name: 'Live Fast',
  id: TRAIT.LIVE_FAST,
  balance: {
    effects: [
      { name: boonKey(BOON.FURY), type: 'boon', boon: BOON.FURY, duration: 6, stacks: 1 },
      { name: boonKey(BOON.QUICKNESS), type: 'boon', boon: BOON.QUICKNESS, duration: 3, stacks: 1 }
    ]
  },
  triggers: [
    onTriggerPoint(mergedBeastHit, {
      run: (runtime, input: TriggerPointInput<typeof mergedBeastHit>) => triggerMergedLiveFast(runtime, input.event)
    })
  ]
});

/** Owns Twice as Vicious's live tuning and trait behavior. */
const twiceAsVicious = defineTrait({
  name: 'Twice as Vicious',
  id: TRAIT.TWICE_AS_VICIOUS,
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
      amount: (context) => balanceNumberFromContext(context, TRAIT.TWICE_AS_VICIOUS, 'damageIncrease'),
      when: (context) => activeBuff(context, 'twice-as-vicious')
    },
    {
      order: 105,
      requiresSelection: false,
      id: 'ranger.twice-as-vicious-condition',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      amount: (context) => balanceNumberFromContext(context, TRAIT.TWICE_AS_VICIOUS, 'conditionDamageIncrease'),
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
                recipients: RECIPIENT.PARTY,
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
const predatorsCunning = defineTrait({
  name: "Predator's Cunning",
  id: TRAIT.PREDATORS_CUNNING,
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
      when: (_runtime, event) => event.condition === CONDITION.POISONED,
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
const oppressiveSuperiority = defineTrait({
  name: 'Oppressive Superiority',
  id: TRAIT.OPPRESSIVE_SUPERIORITY,
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
      factor: (context) => balanceNumberFromContext(context, TRAIT.OPPRESSIVE_SUPERIORITY, 'damageMultiplier'),
      when: oppressiveSuperiorityActive
    },
    {
      order: 107,
      id: 'ranger.oppressive-superiority-condition-duration',
      target: MODIFIER_TARGET.CONDITION_DURATION,
      operation: 'add',
      amount: (context) => balanceNumberFromContext(context, TRAIT.OPPRESSIVE_SUPERIORITY, 'conditionDurationBonus'),
      when: oppressiveSuperiorityActive
    }
  ]
});

/** Owns Essence of Speed's live tuning and trait behavior. */
const essenceOfSpeed = defineTrait({
  name: 'Essence of Speed',
  id: TRAIT.ESSENCE_OF_SPEED,
  balance: {
    internalCooldown: 5,
    duration: 2
  }
});

/** Owns Furious Strength's live tuning and trait behavior. */
const furiousStrength = defineTrait({
  name: 'Furious Strength',
  id: TRAIT.FURIOUS_STRENGTH,
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageIncrease: 0.15 },
  modifierRules: [
    {
      order: 101,
      id: 'ranger.furious-strength',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: (context) => balanceNumberFromContext(context, TRAIT.FURIOUS_STRENGTH, 'damageIncrease'),
      // Furious Strength requires the player to have Fury; pet fury does not count.
      when: (context) => boonActive(context, boonKey(BOON.FURY))
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
  const profile = requireBalanceProfileFromContext(context, TRAIT.LIVE_FAST);
  const fury = requireEffect(profile, 'boon', boonKey(BOON.FURY));
  const quickness = requireEffect(profile, 'boon', boonKey(BOON.QUICKNESS));

  if (fury) context.effects.emit(rangerProfileEffectRequest(event, profile, fury, TRAIT.LIVE_FAST, 'Live Fast'));

  if (quickness)
    context.effects.emit(rangerProfileEffectRequest(event, profile, quickness, TRAIT.LIVE_FAST, 'Live Fast'));
}

// Called from both enter- and exit-beastmode handlers; protection fires on every toggle regardless of direction.
function applyUnstoppableUnion(context: RangerRuntime, skill: RangerSkill): void {
  const profile = requireBalanceProfileFromContext(context, TRAIT.UNSTOPPABLE_UNION);
  const effect = requireEffect(profile, 'boon', boonKey(BOON.PROTECTION));

  if (!effect) return;

  emitTraitProfile(context, TRAIT.UNSTOPPABLE_UNION, TRAIT.UNSTOPPABLE_UNION, undefined, {
    at: context.time,
    fullEnd: context.time,
    effect: { type: 'boon', name: boonKey(BOON.PROTECTION) },
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.UNSTOPPABLE_UNION,
      actorType: ACTOR.EFFECT,
      skillId: skill.id,
      skillName: 'Unstoppable Union',
      name: 'Unstoppable Union'
    }
  });
}
