import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';

import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import {
  legendInvoked,
  revenantConditionApplied,
  type RevenantStrike
} from '#gw2/professions/revenant/core/mechanics/boundaries.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';

/** Owns Abyssal Chill tuning and behavior at its established execution boundaries. */
export const abyssalChill = defineTrait({
  triggers: [onTriggerPoint(revenantConditionApplied, { run: reactAbyssalChill })],
  id: TRAIT.ABYSSAL_CHILL,
  name: 'Abyssal Chill',
  balance: {
    categories: ['Trait'],
    skillFamily: 'Trait',
    effects: [
      {
        name: 'Torment',
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ]
  }
});

/** Owns Acolyte of Torment tuning and behavior at its established execution boundaries. */
export const acolyteOfTorment = defineTrait({
  id: TRAIT.ACOLYTE_OF_TORMENT,
  name: 'Acolyte of Torment',
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { conditionDamageMultiplier: 1.1 },
  modifierRules: [
    {
      id: 'revenant.acolyte-of-torment',
      order: 2,
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.ACOLYTE_OF_TORMENT),
          'conditionDamageMultiplier'
        ),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && context.condition === 'Torment'
    }
  ]
});

/** Owns Diabolic Inferno tuning and behavior at its established execution boundaries. */
export const diabolicInferno = defineTrait({
  id: TRAIT.DIABOLIC_INFERNO,
  name: 'Diabolic Inferno',
  balance: {
    effects: impactEffects({ atMs: 760, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 10,
        name: 'Invoke Torment - Poisoned',
        skillName: 'Invoke Torment',
        actorType: 'player',
        metadata: { trigger: 'diabolic-inferno' }
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 4,
        name: 'Invoke Torment - Burning',
        skillName: 'Invoke Torment',
        actorType: 'player',
        metadata: { trigger: 'diabolic-inferno' }
      }
    ])
  }
});

/** Owns invocation strike and condition tuning. */
export const invokingTorment = defineTrait({
  triggers: [onTriggerPoint(legendInvoked, { run: invokeTorment })],
  id: TRAIT.INVOKING_TORMENT,
  name: 'Invoking Torment',
  balance: {
    id: TRAIT.INVOKING_TORMENT,
    categories: ['Trait'],
    skillFamily: 'Trait',
    effects: impactEffects({ atMs: 760, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Invoke Torment',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 1,
        duration: 10,
        name: 'Invoke Torment - Torment',
        skillName: 'Invoke Torment',
        actorType: 'player'
      }
    ])
  }
});

/** Owns Pact of Pain tuning and behavior at its established execution boundaries. */
export const pactOfPain = defineTrait({
  buildAttributes: (_common, { balanceContext }) => ({
    traitDurations: {
      'Condition Duration':
        100 *
        balanceProfileNumber(
          requireBalanceProfileFromContext(balanceContext, TRAIT.PACT_OF_PAIN),
          'conditionDurationBonus'
        )
    }
  }),
  id: TRAIT.PACT_OF_PAIN,
  name: 'Pact of Pain',
  balance: { conditionDurationBonus: 0.15 }
});

/** Owns Seething Malice tuning and behavior at its established execution boundaries. */
export const seethingMalice = defineTrait({
  buildAttributes: traitAttributeEffects(TRAIT.SEETHING_MALICE, [
    { kind: 'flat', to: 'Condition Damage', field: 'attributeBonus', feedsConversions: false }
  ]),
  id: TRAIT.SEETHING_MALICE,
  name: 'Seething Malice',
  balance: { attributeBonus: 120 }
});

/** Owns Yearning Empowerment tuning and behavior at its established execution boundaries. */
export const yearningEmpowerment = defineTrait({
  buildAttributes: (_common, { balanceContext }) => ({
    traitDurations: Object.fromEntries(
      ['Bleeding', 'Burning', 'Confusion', 'Poison', 'Torment'].map((condition) => [
        condition + ' Duration',
        100 *
          balanceProfileNumber(
            requireBalanceProfileFromContext(balanceContext, TRAIT.YEARNING_EMPOWERMENT),
            'conditionDurationBonus'
          )
      ])
    )
  }),
  id: TRAIT.YEARNING_EMPOWERMENT,
  name: 'Yearning Empowerment',
  balance: { conditionDurationBonus: 0.1 }
});

/** Runs the trait at its original ordered mechanic boundary. */
function reactAbyssalChill(runtime: RevenantRuntime, { cause: event }: RevenantStrike): void {
  if (event.condition === 'Chilled') {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.ABYSSAL_CHILL);
    const condition = requireEffect(profile, 'condition', 'Torment');
    if (condition) {
      const name = String(condition.condition);
      emitTraitProfile(runtime, TRAIT.ABYSSAL_CHILL, TRAIT.ABYSSAL_CHILL, event, {
        at: runtime.time,
        fullEnd: runtime.time,
        effect: { type: 'condition', name: 'Torment' },
        attribution: {
          source: 'revenant',
          sourceId: TRAIT.ABYSSAL_CHILL,
          actorType: 'player',
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
        actorType: 'player',
        skillId: TRAIT.INVOKING_TORMENT,
        skillName: 'Invoke Torment'
      },
      skillWeaponFallback: 'Unequipped'
    });
}
