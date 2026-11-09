// Profile materialization owns ordinary payload fields; local handlers retain admission and delivery context.
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { buffActive } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { ACTOR, BOON, COMBO_FIELD, COMBO_FINISHER, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import { emitTraitProfile, invokeTraitSkill } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { definePeriodicTask } from '#gw2/platform/simulation/periodic-task.js';
import { balanceNumber, requireBalanceProfile, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import { rangerInitialized } from '#gw2/professions/ranger/core/mechanics/trigger-points.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { avatarExited } from '#gw2/professions/ranger/specializations/druid/mechanics/celestial-avatar.js';
import { SEED_OF_LIFE_DETONATION_MS } from '#gw2/professions/ranger/specializations/druid/skills/index.js';
import { druidState } from '#gw2/professions/ranger/specializations/druid/state.js';
import type { RangerRuntime } from '#gw2/professions/ranger/types.js';

function naturalBalanceActive(context: Gw2ModifierContext): boolean {
  // Registration gates selection; only the Druid's own packets receive the active buff bonus.
  if (!isGw2PlayerModifierOwnedEvent(context.event)) return false;

  // Scheduler path uses a timeline; resolver path reads from the runtime boon list
  return buffActive(context, 'natural-balance');
}

/** Avatar suppresses grants while the unrounded Natural Mender cadence continues. */
export const naturalMenderPassive = definePeriodicTask<RangerRuntime>({
  name: 'ranger.natural-mender',
  background: true,
  priority: -1,
  state: (runtime) => druidState.from(runtime.profession).naturalMender,
  nextAt(runtime) {
    const state = druidState.from(runtime.profession).naturalMender;
    const interval = balanceNumber(runtime.helpers, TRAIT.NATURAL_MENDER, 'pulseInterval');

    if (interval <= 0) return Infinity;

    state.deadline += interval;
    return gw2CooldownReadyAt(state.deadline);
  },
  run(runtime) {
    if (druidState.from(runtime.profession).celestialAvatarEndsAt === null)
      runtime.resourceController.grant(
        'astralForce',
        balanceNumber(runtime.helpers, TRAIT.NATURAL_MENDER, 'resourceGain')
      );
  }
});

/** Owns Natural Mender's live tuning and trait behavior. */
const naturalMender = defineTrait({
  id: TRAIT.NATURAL_MENDER,
  balance: {
    pulseInterval: 3,
    resourceGain: 8
  },
  triggers: [
    onTriggerPoint(rangerInitialized, {
      run(runtime) {
        const interval = balanceNumber(runtime.helpers, TRAIT.NATURAL_MENDER, 'pulseInterval');

        if (interval > 0) {
          druidState.from(runtime.profession).naturalMender.deadline = interval;
          naturalMenderPassive.restart(runtime, gw2CooldownReadyAt(interval));
        }
      }
    })
  ],
  lifetime: naturalMenderPassive.hooks
});

/** Owns Natural Balance's live tuning and trait behavior. */
const naturalBalance = defineTrait({
  id: TRAIT.NATURAL_BALANCE,
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
      amount: (context) => balanceNumber(context.catalog, TRAIT.NATURAL_BALANCE, 'conditionDamageIncrease'),
      when: naturalBalanceActive
    },
    {
      order: 101,
      id: 'ranger.natural-balance-condition-duration',
      target: MODIFIER_TARGET.CONDITION_DURATION,
      operation: 'add',
      amount: (context) => balanceNumber(context.catalog, TRAIT.NATURAL_BALANCE, 'conditionDurationBonus'),
      when: naturalBalanceActive
    }
  ],
  triggers: [onTriggerPoint(avatarExited, { run: (runtime) => applyNaturalBalance(runtime) })]
});

/** Owns Grace of the Land's live tuning and trait behavior. */
const graceOfTheLand = defineTrait({
  id: TRAIT.GRACE_OF_THE_LAND,
  balance: {
    effects: [{ name: BOON.ALACRITY, type: 'boon', boon: BOON.ALACRITY, duration: 1, stacks: 1 }]
  }
});

/** Each successful player-owned water blast plants a seed; its bloom survives leaving Avatar. */
const cultivatedSynergy = defineTrait({
  id: TRAIT.CULTIVATED_SYNERGY,
  balance: { duration: SEED_OF_LIFE_DETONATION_MS / 1000 },
  triggers: [
    {
      on: 'combo.resolved',
      when: (_runtime, event) =>
        event.type === 'combo' &&
        event.fieldType === COMBO_FIELD.WATER &&
        event.finisherType === COMBO_FINISHER.BLAST &&
        isGw2PlayerModifierOwnedEvent(event),
      run(runtime, event) {
        const at = event.at + balanceNumber(runtime.helpers, TRAIT.CULTIVATED_SYNERGY, 'duration');
        invokeTraitSkill(runtime, TRAIT.CULTIVATED_SYNERGY, ID.LESSER_SEED_OF_LIFE, event, { at });

        // Alacrity belongs to the bloom even when no enemy receives its blind.
        if (hasTrait(runtime, TRAIT.GRACE_OF_THE_LAND))
          emitTraitProfile(runtime, TRAIT.GRACE_OF_THE_LAND, TRAIT.GRACE_OF_THE_LAND, event, {
            at,
            effect: { type: 'boon', name: BOON.ALACRITY },
            attribution: {
              ownerActorType: ACTOR.PLAYER,
              skillId: ID.LESSER_SEED_OF_LIFE,
              skillName: 'Lesser Seed of Life',
              triggeredBy: event.skillName,
              audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
            }
          });
      }
    }
  ]
});

/** Owns Eclipse's live tuning and trait behavior. */
const eclipse = defineTrait({
  id: TRAIT.ECLIPSE,
  balance: {
    coefficientMultiplier: 2,
    effects: [
      {
        name: 'Cosmic Ray',
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        duration: 8,
        stacks: 1
      },
      { name: 'Seed of Life', type: 'condition', condition: CONDITION.POISONED, duration: 8, stacks: 3 },
      {
        name: 'Lunar Impact',
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        duration: 3,
        stacks: 1
      },
      { name: 'Rejuvenating Tides', type: 'condition', condition: CONDITION.CHILLED, duration: 2, stacks: 1 },
      { name: 'Natural Convergence', type: 'condition', condition: CONDITION.BURNING, duration: 5, stacks: 1 },
      {
        name: 'Natural Convergence final pulse',
        type: 'condition',
        condition: CONDITION.BURNING,
        duration: 5,
        stacks: 3
      }
    ]
  }
});

/** Owns Blood Moon's live tuning and trait behavior. */
const bloodMoon = defineTrait({
  id: TRAIT.BLOOD_MOON,
  balance: {
    effects: [{ name: CONDITION.BLEEDING, type: 'condition', condition: CONDITION.BLEEDING, duration: 4, stacks: 2 }]
  },
  triggers: [
    {
      on: 'control.resolved',
      // Pet disables do not activate the player's trait; player-owned child effects still do.
      when: (_runtime, event) => isGw2PlayerModifierOwnedEvent(event),
      emit: TRAIT.BLOOD_MOON,
      effects: (effect) => effect.type === 'condition' && effect.name === CONDITION.BLEEDING,
      attribution: (_runtime, event) => ({
        ownerActorType: ACTOR.PLAYER,
        skillId: TRAIT.BLOOD_MOON,
        skillName: 'Blood Moon',
        name: 'Blood Moon - Bleeding',
        triggeredBy: event.skillName
      })
    },
    {
      on: 'condition.applied',
      when: (_runtime, event) =>
        isGw2PlayerModifierOwnedEvent(event) &&
        (event.condition === CONDITION.IMMOBILIZED || event.condition === 'Immobile'),
      emit: TRAIT.BLOOD_MOON,
      effects: (effect) => effect.type === 'condition' && effect.name === CONDITION.BLEEDING,
      attribution: (_runtime, event) => ({
        ownerActorType: ACTOR.PLAYER,
        skillId: TRAIT.BLOOD_MOON,
        skillName: 'Blood Moon',
        name: 'Blood Moon - Bleeding',
        triggeredBy: event.skillName
      })
    }
  ]
});

/** Register authored owners in a fixed order; runtime boundaries stay explicit. */
/** The unlocking minor owns baseline specialization policy even when omitted from explicit selections. */
const intrinsicPolicy = defineTrait({
  id: TRAIT.CELESTIAL_BEING,
  balance: { maximumStacks: 100, astralForceRetentionMultiplier: 0.5, resourceGain: 0.75 }
});

export const druidTraits = [
  intrinsicPolicy,
  naturalMender,
  naturalBalance,
  graceOfTheLand,
  cultivatedSynergy,
  eclipse,
  bloodMoon
];

/** Fires at the Avatar transition before chain reset and swap reactions. */
function applyNaturalBalance(runtime: RangerRuntime): void {
  const profile = requireBalanceProfile(runtime.helpers, TRAIT.NATURAL_BALANCE);
  const effect = requireEffect(profile, 'buff', 'natural-balance');

  if (effect)
    emitTraitProfile(runtime, TRAIT.NATURAL_BALANCE, TRAIT.NATURAL_BALANCE, undefined, {
      at: runtime.time,
      fullEnd: runtime.time,
      effect: { type: 'buff', name: 'natural-balance' },
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.NATURAL_BALANCE,
        skillId: TRAIT.NATURAL_BALANCE,
        skillName: 'Natural Balance',
        actorType: ACTOR.PLAYER,
        name: 'Natural Balance'
      }
    });
}
