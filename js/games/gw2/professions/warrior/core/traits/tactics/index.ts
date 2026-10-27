import { ACTOR, RECIPIENT, BOON, CONDITION } from '#gw2/platform/constants.js';
import { boonKey, GW2_STANDARD_BOONS } from '#gw2/platform/combat/boons.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionActive, targetHealthFraction } from '#gw2/platform/combat/query/runtime-query.js';

import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import {
  attributeBonusFromContext,
  balanceNumberFromContext,
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import {
  burstFirstHit,
  coreInitialized,
  focusReset,
  soldierFocusApplied,
  weaponSwapped
} from '#gw2/professions/warrior/core/mechanics/trigger-points.js';
import { warriorActiveBoonCount } from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import type { WarriorRuntime } from '#gw2/professions/warrior/types.js';
import { definePeriodicTask } from '#gw2/platform/simulation/periodic-task.js';

/** Convert Power to Healing Power once, preserving the build's existing conversion pool. */
export const vigorousShouts = defineTrait({
  name: 'Vigorous Shouts',
  id: TRAIT.VIGOROUS_SHOUTS,
  balance: { attributeConversion: 0.13 },
  attributes: traitAttributeEffects(TRAIT.VIGOROUS_SHOUTS, [
    {
      kind: 'conversion',
      from: 'Power',
      to: 'Healing Power',
      field: 'attributeConversion',
      rounding: 'none',
      input: 'eligible'
    }
  ])
});

/** Owns this trait's tuning and selected contributions. */
export const legSpecialist = defineTrait({
  name: 'Leg Specialist',
  id: TRAIT.LEG_SPECIALIST,
  balance: {
    damageMultiplier: 1.05,
    effects: [
      { name: CONDITION.IMMOBILIZED, type: 'condition', condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 1 }
    ]
  },
  modifierRules: [
    {
      id: 'warrior.leg-specialist',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.LEG_SPECIALIST, 'damageMultiplier'),
      order: 91,
      when: (context) =>
        [CONDITION.CRIPPLED, CONDITION.CHILLED, CONDITION.IMMOBILIZED].some((condition) =>
          targetConditionActive(context, condition)
        )
    }
  ],
  triggers: [
    {
      order: 8,

      on: 'condition.applied',
      when: (_runtime, event) => event.condition === CONDITION.CRIPPLED,
      emit: TRAIT.LEG_SPECIALIST,
      attribution: { priority: 5 }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const marchingOrders = defineTrait({
  name: 'Marching Orders',
  id: TRAIT.MARCHING_ORDERS,
  balance: {
    internalCooldown: 10,
    effects: [{ name: boonKey(BOON.MIGHT), type: 'boon', boon: BOON.MIGHT, stacks: 3, duration: 15 }]
  },
  triggers: [
    onTriggerPoint(burstFirstHit, {
      run: (runtime, input: TriggerPointInput<typeof burstFirstHit>) => soldierFocusBurst(runtime, input.event)
    })
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const soldiersComfort = defineTrait({
  name: "Soldier's Comfort",
  id: TRAIT.SOLDIERS_COMFORT,
  balance: {
    effects: [{ name: boonKey(BOON.PROTECTION), type: 'boon', boon: BOON.PROTECTION, stacks: 1, duration: 4 }]
  },
  triggers: [
    onTriggerPoint(soldierFocusApplied, {
      run: (runtime, input: TriggerPointInput<typeof soldierFocusApplied>) =>
        emitSoldierFocusReward(runtime, input.event, TRAIT.SOLDIERS_COMFORT)
    })
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const martialCadence = defineTrait({
  name: 'Martial Cadence',
  id: TRAIT.MARTIAL_CADENCE,
  balance: {
    effects: [{ name: boonKey(BOON.STABILITY), type: 'boon', boon: BOON.STABILITY, stacks: 1, duration: 3 }]
  },
  triggers: [
    onTriggerPoint(soldierFocusApplied, {
      run: (runtime, input: TriggerPointInput<typeof soldierFocusApplied>) =>
        emitSoldierFocusReward(runtime, input.event, TRAIT.MARTIAL_CADENCE)
    }),
    onTriggerPoint(focusReset, { run: (runtime) => resetSoldierFocus(runtime) }),
    onTriggerPoint(weaponSwapped, { run: (runtime) => resetSoldierFocus(runtime) })
  ]
});

/** Missing Might or disabled cadence ends the loop; an admitted pulse keeps its original priority. */
const empowerAlliesPassive = definePeriodicTask<WarriorRuntime>({
  name: 'warrior.empower-allies-pulse',
  background: true,
  priority: -210,
  state: (runtime) => runtime.profession.core.empowerAllies,
  nextAt: (runtime) => runtime.time + balanceNumberFromContext(runtime, TRAIT.EMPOWER_ALLIES, 'pulseInterval'),
  run: empowerPulse
});

/** Owns this trait's tuning and selected contributions. */
export const empowerAllies = defineTrait({
  name: 'Empower Allies',
  id: TRAIT.EMPOWER_ALLIES,
  balance: {
    pulseInterval: 10,
    effects: [{ name: boonKey(BOON.MIGHT), type: 'boon', boon: BOON.MIGHT, stacks: 5, duration: 10 }]
  },
  triggers: [onTriggerPoint(coreInitialized, { run: (runtime) => initializeEmpowerAllies(runtime) })],
  lifetime: empowerAlliesPassive.hooks
});

/** Owns this trait's tuning and selected contributions. */
export const roaringReveille = defineTrait({
  name: 'Roaring Reveille',
  id: TRAIT.ROARING_REVEILLE,
  balance: {
    attributeBonuses: { concentration: 120 }
  },
  attributes(context) {
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Concentration',
          amount: attributeBonusFromContext(context.balanceContext, TRAIT.ROARING_REVEILLE, 'concentration'),
          feedsConversions: 'none',
          enabled: true
        }
      ]
    };
  }
});

/** Owns this trait's tuning and selected contributions. */
export const empowered = defineTrait({
  name: 'Empowered',
  id: TRAIT.EMPOWERED,
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damagePerBoon: 0.01, maximumBoons: GW2_STANDARD_BOONS.length },
  modifierRules: [
    {
      id: 'warrior.empowered',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      // Count unique boons only up to the selected balance cap.

      factor: (context) =>
        1 +
        Math.min(balanceNumberFromContext(context, TRAIT.EMPOWERED, 'maximumBoons'), warriorActiveBoonCount(context)) *
          balanceNumberFromContext(context, TRAIT.EMPOWERED, 'damagePerBoon'),
      order: 90
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const warriorsCunning = defineTrait({
  name: "Warrior's Cunning",
  id: TRAIT.WARRIORS_CUNNING,
  // Trait balance is the single tuning source for modifiers and presentation.
  balance: { damageMultiplier: 1.25, threshold: 0.8 },
  modifierRules: [
    {
      id: 'warrior.warriors-cunning',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => balanceNumberFromContext(context, TRAIT.WARRIORS_CUNNING, 'damageMultiplier'),
      order: 92,
      when: (context) =>
        targetHealthFraction(context) > balanceNumberFromContext(context, TRAIT.WARRIORS_CUNNING, 'threshold')
    }
  ]
});

function empowerPulse(runtime: WarriorRuntime): void {
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.EMPOWER_ALLIES);
  const interval = balanceProfileNumber(profile, 'pulseInterval');
  const might = requireEffect(profile, 'boon', boonKey(BOON.MIGHT));

  if (!hasTrait(runtime, TRAIT.EMPOWER_ALLIES) || interval <= 0 || !might) {
    empowerAlliesPassive.stop(runtime);
    return;
  }

  {
    const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.EMPOWER_ALLIES);
    emitTraitProfile(
      runtime,
      TRAIT.EMPOWER_ALLIES,
      TRAIT.EMPOWER_ALLIES,
      { sourceId: TRAIT.EMPOWER_ALLIES, actorType: ACTOR.EFFECT },
      {
        attribution: { source: 'Trait', sourceId: TRAIT.EMPOWER_ALLIES, actorType: ACTOR.EFFECT },
        transform: (packet) => ({
          ...packet,
          name: traitProfile.name,
          stacks: 1 * Number(packet.stacks),
          priority: 0,
          audience: { recipients: RECIPIENT.PARTY }
        }),
        effects: (candidate) => candidate === might
      }
    );
  }
}

/** Apply line-owned rewards at the shared reaction boundary. */
function soldierFocusBurst(runtime: WarriorRuntime, event: Gw2ResolverEvent): void {
  if (runtime.procs.claim(TRAIT.MARCHING_ORDERS, 'warrior.core.soldierFocus', runtime.time)) {
    // All Soldier's Focus rewards share the claim; Martial Cadence still owns its explicit swap resets.
    emitSoldierFocusReward(runtime, event, TRAIT.MARCHING_ORDERS);

    runtime.fireTrigger(soldierFocusApplied, { event });
  }
}

/** Apply line-owned rewards at the shared reaction boundary. */
function resetSoldierFocus(runtime: WarriorRuntime): void {
  runtime.procs.setDeadline('warrior.core.soldierFocus', runtime.time);
}

/** Arm the first selected pulse after the Core pool is initialized. */
function initializeEmpowerAllies(runtime: WarriorRuntime): void {
  empowerAlliesPassive.restart(runtime, 0);
}

/** Focus rewards share party delivery after the proc claim while each trait retains its own tuning and identity. */
function emitSoldierFocusReward(runtime: WarriorRuntime, event: Gw2ResolverEvent, traitId: number): void {
  const traitProfile = requireBalanceProfileFromContext(runtime, traitId);
  emitTraitProfile(runtime, traitId, traitId, event, {
    attribution: {
      source: 'Trait',
      sourceId: traitId,
      actorType: ACTOR.EFFECT,
      skillId: event.skillId,
      skillName: event.skillName
    },
    transform: (packet) => ({
      ...packet,
      priority: 5,
      name: traitProfile.name,
      stacks: Number(packet.stacks),
      audience: { recipients: RECIPIENT.PARTY }
    }),
    effects: (effect) => ['boon', 'buff', 'condition'].includes(effect.type)
  });
}
