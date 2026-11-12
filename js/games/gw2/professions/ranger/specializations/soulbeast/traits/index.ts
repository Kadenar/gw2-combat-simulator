// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.

import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { claimActivation } from '#gw2/platform/combat/procs/activation-claims.js';
import { boonActive } from '#gw2/platform/combat/query/runtime-query.js';
import { ACTOR, BOON, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import type { ProfileEmission } from '#gw2/platform/effects/emission.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { balanceNumber, requireBalanceProfile, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import { rangerProfileEffectRequest } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
import { beastmodeChanged, mergedBeastHit } from '#gw2/professions/ranger/core/mechanics/trigger-points.js';
import { activeBuff } from '#gw2/professions/ranger/core/traits/modifier-queries.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { soulbeastState } from '#gw2/professions/ranger/specializations/soulbeast/state.js';
import type { RangerResolverContext, RangerRuntime, RangerSkill } from '#gw2/professions/ranger/types.js';

/** Owns Unstoppable Union's live tuning and trait behavior. */
const unstoppableUnion = defineTrait({
  id: TRAIT.UNSTOPPABLE_UNION,
  balance: {
    effects: [{ name: BOON.PROTECTION, type: 'boon', boon: BOON.PROTECTION, duration: 2.5, stacks: 1 }]
  },
  triggers: [
    onTriggerPoint(beastmodeChanged, {
      run: (runtime, input: TriggerPointInput<typeof beastmodeChanged>) => applyUnstoppableUnion(runtime, input.skill)
    })
  ]
});

/** Owns Leader of the Pack's live tuning and trait behavior. */
const leaderOfThePack = defineTrait({
  id: TRAIT.LEADER_OF_THE_PACK,
  balance: {
    durationMultiplier: 1.2,
    sharedDurationMultiplier: 0.5
  }
});

/** Owns Live Fast's live tuning and trait behavior. */
const liveFast = defineTrait({
  id: TRAIT.LIVE_FAST,
  balance: {
    effects: [
      { name: BOON.FURY, type: 'boon', boon: BOON.FURY, duration: 6, stacks: 1 },
      { name: BOON.QUICKNESS, type: 'boon', boon: BOON.QUICKNESS, duration: 3, stacks: 1 }
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
      amount: (context) => balanceNumber(context.catalog, TRAIT.TWICE_AS_VICIOUS, 'damageIncrease'),
      when: (context) => activeBuff(context, 'twice-as-vicious')
    },
    {
      order: 105,
      requiresSelection: false,
      id: 'ranger.twice-as-vicious-condition',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      amount: (context) => balanceNumber(context.catalog, TRAIT.TWICE_AS_VICIOUS, 'conditionDamageIncrease'),
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
          requireEffect(requireBalanceProfile(runtime.helpers, TRAIT.TWICE_AS_VICIOUS), 'buff', 'twice-as-vicious')
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

// Merged impacts launch independent frenzies, including Feline Maul and Primal Cry repeats.
const apexPredator = defineTrait({
  id: TRAIT.APEX_PREDATOR,
  balance: {
    effects: [
      {
        name: 'Apex Predator',
        type: 'strike',
        weapon: 'Unequipped',
        ticks: Array.from({ length: 6 }, (_, index) => ({ atMs: index * 200, coefficient: 0.3 }))
      },
      {
        name: 'Apex Predator (Beast)',
        type: 'strike',
        weapon: 'Unequipped',
        ticks: Array.from({ length: 9 }, (_, index) => ({ atMs: index * 200, coefficient: 0.3 }))
      }
    ]
  },
  triggers: [
    {
      on: 'damage.resolved',
      when: (_runtime, event) => Number(event.coefficient) > 0 && event.skillId !== ID.UNDEAD_PLAGUE,
      run: triggerApexPredator
    },
    {
      // Poison Gas triggers on its poison application despite having no strike.
      on: 'condition.applied',
      when: (_runtime, event) => event.skillId === ID.POISON_GAS && event.condition === CONDITION.POISONED,
      run: triggerApexPredator
    }
  ]
});

/** Owns Essence of Speed's live tuning and trait behavior. */
const essenceOfSpeed = defineTrait({
  id: TRAIT.ESSENCE_OF_SPEED,
  balance: {
    internalCooldown: 5,
    duration: 2
  }
});

/** Owns Furious Strength's live tuning and trait behavior. */
const furiousStrength = defineTrait({
  id: TRAIT.FURIOUS_STRENGTH,
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageIncrease: 0.15 },
  modifierRules: [
    {
      order: 101,
      id: 'ranger.furious-strength',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: (context) => balanceNumber(context.catalog, TRAIT.FURIOUS_STRENGTH, 'damageIncrease'),
      // Furious Strength requires the player to have Fury; pet fury does not count.
      when: (context) => boonActive(context, BOON.FURY)
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
  apexPredator,
  essenceOfSpeed,
  furiousStrength
];

/** Runs once on the accepted first hit of the merged Beast ability. */
function triggerMergedLiveFast(context: RangerResolverContext, event: Gw2ResolverEvent): void {
  const profile = requireBalanceProfile(context.helpers, TRAIT.LIVE_FAST);
  const fury = requireEffect(profile, 'boon', BOON.FURY);
  const quickness = requireEffect(profile, 'boon', BOON.QUICKNESS);

  if (fury) context.effects.emit(rangerProfileEffectRequest(event, profile, fury, TRAIT.LIVE_FAST, 'Live Fast'));

  if (quickness)
    context.effects.emit(rangerProfileEffectRequest(event, profile, quickness, TRAIT.LIVE_FAST, 'Live Fast'));
}

// Called from both enter- and exit-beastmode handlers; protection fires on every toggle regardless of direction.
function applyUnstoppableUnion(context: RangerRuntime, skill: RangerSkill): void {
  const profile = requireBalanceProfile(context.helpers, TRAIT.UNSTOPPABLE_UNION);
  const effect = requireEffect(profile, 'boon', BOON.PROTECTION);

  if (!effect) return;

  emitTraitProfile(context, TRAIT.UNSTOPPABLE_UNION, TRAIT.UNSTOPPABLE_UNION, undefined, {
    at: context.time,
    fullEnd: context.time,
    effect: { type: 'boon', name: BOON.PROTECTION },
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

// Claim eligible merged impacts before emitting player-owned frenzies.
function triggerApexPredator(runtime: RangerResolverContext, event: Gw2ResolverEvent): void {
  const state = soulbeastState.from(runtime.profession);
  const skill: RangerSkill | undefined =
    event.skillId == null ? undefined : runtime.helpers.skillsById.get(event.skillId);

  if (!state.beastmodeActive || event.actorType !== ACTOR.PLAYER || !skill?.beastmodeSkill || !event.activationId)
    return;

  // Gazelle Charge grants its frenzy on the final impact, never its travel strike.
  if (skill.id === ID.CHARGE && event.name !== 'Charge - Impact Damage') return;

  // Most skills claim one frenzy per activation. These two skills claim one per landed hit instead.
  const repeated = skill.id === ID.MAUL_ID_44514 || skill.id === ID.PRIMAL_CRY;
  const scope = repeated ? `ranger.apex-predator:${event.hitIndex}` : 'ranger.apex-predator';

  if (!claimActivation(state.soulbeastActivationClaims, scope, event.activationId)) return;

  const beast = skill.slot === 'Profession_3';
  const name = beast ? 'Apex Predator (Beast)' : 'Apex Predator';
  const sourceId = beast ? ID.APEX_PREDATOR_BEAST : ID.APEX_PREDATOR;
  emitTraitProfile(runtime, TRAIT.APEX_PREDATOR, TRAIT.APEX_PREDATOR, event, {
    effect: { type: 'strike', name },
    // Settle the triggering skill's same-time controls and buffs before any frenzy damage.
    priority: 1,
    attribution: {
      sourceId,
      skillId: sourceId,
      skillName: name,
      name,
      actorType: ACTOR.EFFECT,
      ownerActorType: ACTOR.PLAYER,
      // Separate repeats sample their own strength while each frenzy retains its roll across all hits.
      activationId: `${event.activationId}:apex:${repeated ? event.hitIndex : 1}`,
      triggeredBy: event.skillName
    }
  });
}

/** Leader of the Pack extends the personal stance and shares half of that extended window. */
export function leaderOfThePackStance(
  context: RangerRuntime,
  baseDuration: number
): { duration: number; sharedDuration?: number } {
  if (!hasTrait(context, TRAIT.LEADER_OF_THE_PACK)) return { duration: baseDuration };

  const duration = baseDuration * balanceNumber(context.helpers, TRAIT.LEADER_OF_THE_PACK, 'durationMultiplier');
  return {
    duration,
    sharedDuration: duration * balanceNumber(context.helpers, TRAIT.LEADER_OF_THE_PACK, 'sharedDurationMultiplier')
  };
}

/** Each eligible Quickness grant emits a trait-owned extension profile that excludes Quickness itself. */
export function essenceOfSpeedExtension(
  context: RangerResolverContext,
  event: Gw2ResolverEvent
): ProfileEmission | null {
  if (
    event.kind !== BOON.QUICKNESS ||
    !event.resolvedAudience?.includesSelf ||
    !hasTrait(context, TRAIT.ESSENCE_OF_SPEED) ||
    !context.procs.claim(TRAIT.ESSENCE_OF_SPEED, 'ranger.soulbeast.essenceOfSpeed', event.at)
  ) {
    return null;
  }

  return {
    kind: 'profile',
    profile: requireBalanceProfile(context.helpers, TRAIT.ESSENCE_OF_SPEED),
    at: event.at,
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.ESSENCE_OF_SPEED,
      actorType: ACTOR.EFFECT,
      skillId: TRAIT.ESSENCE_OF_SPEED,
      skillName: 'Essence of Speed'
    },
    effects: [
      {
        type: 'custom',
        eventType: 'boon_extension',
        event: {
          duration: balanceNumber(context.helpers, TRAIT.ESSENCE_OF_SPEED, 'duration'),
          excludedKind: BOON.QUICKNESS
        }
      }
    ]
  };
}
