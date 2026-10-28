// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { ACTOR, CONDITION } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import {
  defineTrait,
  traitAttributeBonuses,
  traitAttributeEffects
} from '#gw2/platform/profession-definition/traits.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import {
  legendInvoked,
  revenantConditionApplied,
  type RevenantStrike
} from '#gw2/professions/revenant/core/mechanics/trigger-points.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';

/** Owns Abyssal Chill tuning and behavior at its established execution boundaries. */
export const abyssalChill = defineTrait({
  name: 'Abyssal Chill',
  id: TRAIT.ABYSSAL_CHILL,
  balance: {
    effects: [
      {
        name: CONDITION.TORMENT,
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 1,
        duration: 3,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  triggers: [onTriggerPoint(revenantConditionApplied, { run: reactAbyssalChill })]
});

/** Owns Acolyte of Torment tuning and behavior at its established execution boundaries. */
export const acolyteOfTorment = defineTrait({
  name: 'Acolyte of Torment',
  id: TRAIT.ACOLYTE_OF_TORMENT,
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { conditionDamageMultiplier: 1.1 },
  modifierRules: [
    {
      id: 'revenant.acolyte-of-torment',
      order: 2,
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.ACOLYTE_OF_TORMENT, 'conditionDamageMultiplier'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && context.condition === CONDITION.TORMENT
    }
  ]
});

/** Owns Diabolic Inferno tuning and behavior at its established execution boundaries. */
export const diabolicInferno = defineTrait({
  name: 'Diabolic Inferno',
  id: TRAIT.DIABOLIC_INFERNO,
  balance: {
    effects: impactEffects({ atMs: 760, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'condition',
        condition: CONDITION.POISONED,
        stacks: 1,
        duration: 10,
        name: 'Invoke Torment - Poisoned',
        skillName: 'Invoke Torment',
        actorType: ACTOR.PLAYER,
        metadata: { trigger: 'diabolic-inferno' }
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 4,
        name: 'Invoke Torment - Burning',
        skillName: 'Invoke Torment',
        actorType: ACTOR.PLAYER,
        metadata: { trigger: 'diabolic-inferno' }
      }
    ])
  }
});

/** Owns invocation strike and condition tuning. */
export const invokingTorment = defineTrait({
  name: 'Invoking Torment',
  id: TRAIT.INVOKING_TORMENT,
  balance: {
    id: TRAIT.INVOKING_TORMENT,
    effects: impactEffects({ atMs: 760, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Invoke Torment',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 1,
        duration: 10,
        name: 'Invoke Torment - Torment',
        skillName: 'Invoke Torment',
        actorType: ACTOR.PLAYER
      }
    ])
  },
  triggers: [onTriggerPoint(legendInvoked, { run: invokeTorment })]
});

/** Owns Pact of Pain tuning and behavior at its established execution boundaries. */
export const pactOfPain = defineTrait({
  name: 'Pact of Pain',
  id: TRAIT.PACT_OF_PAIN,
  balance: { conditionDurationBonus: 0.15 },
  attributes: traitAttributeBonuses(TRAIT.PACT_OF_PAIN, (profile) => ({
    traitDurations: { 'Condition Duration': 100 * balanceProfileNumber(profile, 'conditionDurationBonus') }
  }))
});

/** Owns Seething Malice tuning and behavior at its established execution boundaries. */
export const seethingMalice = defineTrait({
  name: 'Seething Malice',
  id: TRAIT.SEETHING_MALICE,
  balance: { attributeBonuses: { conditionDamage: 120 } },
  attributes: traitAttributeEffects(TRAIT.SEETHING_MALICE, [
    { kind: 'flat', to: 'Condition Damage', feedsConversions: 'none' }
  ])
});

/** Owns Yearning Empowerment tuning and behavior at its established execution boundaries. */
export const yearningEmpowerment = defineTrait({
  name: 'Yearning Empowerment',
  id: TRAIT.YEARNING_EMPOWERMENT,
  balance: { conditionDurationBonus: 0.1 },
  attributes: traitAttributeBonuses(TRAIT.YEARNING_EMPOWERMENT, (profile) => ({
    traitDurations: Object.fromEntries(
      [CONDITION.BLEEDING, CONDITION.BURNING, CONDITION.CONFUSION, 'Poison', CONDITION.TORMENT].map((condition) => [
        condition + ' Duration',
        100 * balanceProfileNumber(profile, 'conditionDurationBonus')
      ])
    )
  }))
});

/** Runs the trait at its original ordered mechanic boundary. */
function reactAbyssalChill(runtime: RevenantRuntime, { cause: event }: RevenantStrike): void {
  if (event.condition === CONDITION.CHILLED) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.ABYSSAL_CHILL);
    const condition = requireEffect(profile, 'condition', CONDITION.TORMENT);

    if (condition) {
      const name = String(condition.condition);
      emitTraitProfile(runtime, TRAIT.ABYSSAL_CHILL, TRAIT.ABYSSAL_CHILL, event, {
        at: runtime.time,
        fullEnd: runtime.time,
        effect: { type: 'condition', name: CONDITION.TORMENT },
        attribution: {
          source: 'revenant',
          sourceId: TRAIT.ABYSSAL_CHILL,
          actorType: ACTOR.PLAYER,
          skillId: TRAIT.ABYSSAL_CHILL,
          skillName: 'Abyssal Chill',
          name: `Abyssal Chill — ${name}`
        },
        transform: (packet) => ({
          ...packet,
          stacks: Math.max(0, Number(packet.stacks)) * Math.max(1, event.stacks ?? 1)
        })
      });
    }
  }
}

/** Runs the trait at its original ordered mechanic boundary. */
function invokeTorment(runtime: RevenantRuntime): void {
  // Each selected trait emits its own balance payload while retaining the shared invocation identity.
  const profiles = [
    TRAIT.INVOKING_TORMENT,
    ...(hasTrait(runtime, TRAIT.DIABOLIC_INFERNO) ? [TRAIT.DIABOLIC_INFERNO] : [])
  ];
  for (const profileId of profiles)
    emitTraitProfile(runtime, TRAIT.INVOKING_TORMENT, profileId, undefined, {
      preserveName: true,
      attribution: {
        activationId: `legend-invocation:${TRAIT.INVOKING_TORMENT}:${runtime.time}`,
        source: 'Trait',
        sourceId: TRAIT.INVOKING_TORMENT,
        actorType: ACTOR.PLAYER,
        skillId: TRAIT.INVOKING_TORMENT,
        skillName: 'Invoke Torment'
      },
      skillWeaponFallback: 'Unequipped'
    });
}
