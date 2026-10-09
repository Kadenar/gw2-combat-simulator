import { buffActive } from '#gw2/platform/combat/query/runtime-query.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { druidState } from '#gw2/professions/ranger/specializations/druid/state.js';

function naturalBalanceActive(context: Gw2ModifierContext): boolean {
  // Registration gates selection; only the Druid's own packets receive the active buff bonus.
  if (!isGw2PlayerModifierOwnedEvent(context.event)) return false;
  // Scheduler path uses a timeline; resolver path reads from the runtime boon list
  return buffActive(context, 'natural-balance');
}

/** Owns Natural Mender's live tuning and trait behavior. */
export const naturalMender = defineTrait({
  id: TRAIT.NATURAL_MENDER,
  name: 'Natural Mender',
  balance: {
    pulseInterval: 3,
    resourceGain: 8
  },
  hooks: {
    initialize(runtime) {
      const interval = hasTrait(runtime, TRAIT.NATURAL_MENDER)
        ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.NATURAL_MENDER), 'pulseInterval')
        : 0;
      if (interval > 0) {
        druidState.from(runtime).naturalMenderAt = gw2CooldownReadyAt(interval);
        runtime.schedule('ranger.natural-mender', druidState.from(runtime).naturalMenderAt, interval, undefined, -1);
      }
    },
    tasks: {
      'ranger.natural-mender'(runtime, data) {
        const deadline = Number(data);
        const state = druidState.from(runtime);
        const profile = requireBalanceProfileFromContext(runtime, TRAIT.NATURAL_MENDER);
        if (!state.celestialAvatarActive)
          runtime.resourceController.grant('astralForce', balanceProfileNumber(profile, 'resourceGain'));
        const interval = balanceProfileNumber(profile, 'pulseInterval');
        state.naturalMenderAt = interval > 0 ? gw2CooldownReadyAt(deadline + interval) : Infinity;
        if (interval > 0)
          runtime.schedule('ranger.natural-mender', state.naturalMenderAt, deadline + interval, undefined, -1);
      }
    }
  }
});

/** Owns Natural Balance's live tuning and trait behavior. */
export const naturalBalance = defineTrait({
  id: TRAIT.NATURAL_BALANCE,
  name: 'Natural Balance',
  balance: {
    conditionDamageIncrease: 0.05,
    conditionDurationBonus: 0.1,
    effects: [{ name: 'natural-balance', type: 'buff', kind: 'natural-balance', duration: 10, stacks: 1 }]
  },
  modifierRules: [
    {
      order: 100,
      id: 'ranger.natural-balance-condition-damage',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      amount: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.NATURAL_BALANCE),
          'conditionDamageIncrease'
        ),
      when: naturalBalanceActive
    },
    {
      order: 101,
      id: 'ranger.natural-balance-condition-duration',
      target: MODIFIER_TARGET.CONDITION_DURATION,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.NATURAL_BALANCE),
          'conditionDurationBonus'
        ),
      when: naturalBalanceActive
    }
  ]
});

/** Owns Grace of the Land's live tuning and trait behavior. */
export const graceOfTheLand = defineTrait({
  id: TRAIT.GRACE_OF_THE_LAND,
  name: 'Grace of the Land',
  balance: {
    effects: [{ name: 'alacrity', type: 'boon', boon: 'alacrity', duration: 1, stacks: 1 }]
  }
});

/** Owns Eclipse's live tuning and trait behavior. */
export const eclipse = defineTrait({
  id: TRAIT.ECLIPSE,
  name: 'Eclipse',
  balance: {
    effects: [
      {
        name: 'Cosmic Ray',
        type: 'condition',
        condition: 'Vulnerability',
        duration: 8,
        stacks: 1
      },
      { name: 'Seed of Life', type: 'condition', condition: 'Poisoned', duration: 8, stacks: 3 },
      {
        name: 'Lunar Impact',
        type: 'condition',
        condition: 'Immobilized',
        duration: 3,
        stacks: 1
      },
      { name: 'Rejuvenating Tides', type: 'condition', condition: 'Chilled', duration: 2, stacks: 1 },
      { name: 'Natural Convergence', type: 'condition', condition: 'Burning', duration: 5, stacks: 1 },
      { name: 'Natural Convergence final pulse', type: 'condition', condition: 'Burning', duration: 5, stacks: 3 }
    ]
  }
});

/** Owns Blood Moon's live tuning and trait behavior. */
export const bloodMoon = defineTrait({
  id: TRAIT.BLOOD_MOON,
  name: 'Blood Moon',
  balance: {
    effects: [{ name: 'Bleeding', type: 'condition', condition: 'Bleeding', duration: 4, stacks: 2 }]
  },
  triggers: [
    {
      on: 'control.resolved',
      // Pet disables do not activate the player's trait; player-owned child effects still do.
      when: (_runtime, event) => isGw2PlayerModifierOwnedEvent(event),
      emit: TRAIT.BLOOD_MOON,
      effects: (effect) => effect.type === 'condition' && effect.name === 'Bleeding',
      attribution: (_runtime, event) => ({
        ownerActorType: 'player',
        skillId: TRAIT.BLOOD_MOON,
        skillName: 'Blood Moon',
        name: 'Blood Moon - Bleeding',
        triggeredBy: event.skillName
      })
    },
    {
      on: 'condition.applied',
      when: (_runtime, event) =>
        isGw2PlayerModifierOwnedEvent(event) && (event.condition === 'Immobilized' || event.condition === 'Immobile'),
      emit: TRAIT.BLOOD_MOON,
      effects: (effect) => effect.type === 'condition' && effect.name === 'Bleeding',
      attribution: (_runtime, event) => ({
        ownerActorType: 'player',
        skillId: TRAIT.BLOOD_MOON,
        skillName: 'Blood Moon',
        name: 'Blood Moon - Bleeding',
        triggeredBy: event.skillName
      })
    }
  ]
});

/** Register authored owners in a fixed order; runtime boundaries stay explicit. */
export const druidTraits = [naturalMender, naturalBalance, graceOfTheLand, eclipse, bloodMoon];
