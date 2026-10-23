import { BOON, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import {
  balanceNumberFromContext,
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import {
  thiefCastCompleted,
  thiefMobilityUsed,
  thiefReworkStruck,
  type ThiefCastCompletion
} from '#gw2/professions/thief/core/mechanics/trigger-points.js';
import { THIEF_CORE_REWORK_TRAIT_IDS as REWORK } from '#gw2/professions/thief/core/rework/ids.js';
import { consumeDeftInitiation } from '#gw2/professions/thief/core/rework/mechanics/deft-initiation.js';
import { reworkCoreState } from '#gw2/professions/thief/core/rework/state.js';
import { THIEF_SKILL_IDS as SKILL, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

/** Mark remains a Steal replacement, but its existing movement flag does not represent actual mobility. */
const mobilityEligible = (_runtime: unknown, { cast }: ThiefCastCompletion) => cast.skill.id !== SKILL.DEADEYES_MARK;

/** Combat entry and mobility arm one next-hit payload; unknown numbers stay in the selected profiles. */
export const deftInitiation = defineTrait({
  id: REWORK.DEFT_INITIATION,
  name: 'Deft Initiation',
  balance: {
    internalCooldown: 0,
    effects: [
      {
        type: 'boon',
        name: BOON.MIGHT,
        boon: BOON.MIGHT,
        stacks: 3,
        duration: 8,
        audience: { recipients: RECIPIENT.SELF }
      },
      { type: 'condition', name: CONDITION.VULNERABILITY, condition: CONDITION.VULNERABILITY, stacks: 3, duration: 8 }
    ]
  },
  triggers: [
    onTriggerPoint(thiefMobilityUsed, {
      when: mobilityEligible,
      run(runtime: ThiefRuntime) {
        reworkCoreState(runtime).deftInitiationArmed = true;
      }
    }),
    onTriggerPoint(thiefReworkStruck, { run: consumeDeftInitiation })
  ]
});

/** Cause-free cast completion emits self swiftness explicitly; zero cooldown never merges same-instant grants. */
export const felineGrace = defineTrait({
  id: TRAIT.FELINE_GRACE,
  name: 'Feline Grace',
  balance: {
    internalCooldown: 0,
    effects: [
      {
        type: 'boon',
        name: BOON.SWIFTNESS,
        boon: BOON.SWIFTNESS,
        stacks: 1,
        duration: 5,
        audience: { recipients: RECIPIENT.SELF }
      }
    ]
  },
  triggers: [
    onTriggerPoint(thiefMobilityUsed, {
      when: mobilityEligible,
      run(runtime: ThiefRuntime, { cast }: ThiefCastCompletion) {
        const profile = requireBalanceProfileFromContext(runtime, TRAIT.FELINE_GRACE);
        const effect = requireEffect(profile, 'boon', BOON.SWIFTNESS);

        if (!effect || effectNumber(profile, effect, 'stacks') <= 0 || effectNumber(profile, effect, 'duration') <= 0)
          return;

        const cooldown = balanceProfileNumber(profile, 'internalCooldown');

        if (cooldown > 0 && !runtime.procs.claimCooldown(TRAIT.FELINE_GRACE, runtime.time, cooldown)) return;

        emitTraitProfile(runtime, TRAIT.FELINE_GRACE, TRAIT.FELINE_GRACE, undefined, {
          at: runtime.time,
          activationId: cast.id,
          skillId: TRAIT.FELINE_GRACE,
          skillName: 'Feline Grace',
          effect: { type: 'boon', name: BOON.SWIFTNESS }
        });
      }
    })
  ]
});

/** Target assumptions and applied impairing conditions share the same damage predicate. */
export const opportuneOpening = defineTrait({
  id: REWORK.OPPORTUNE_OPENING,
  name: 'Opportune Opening',
  balance: {
    damageIncrease: 0,
    effects: [{ type: 'condition', name: CONDITION.CRIPPLED, condition: CONDITION.CRIPPLED, stacks: 1, duration: 3 }]
  },
  modifierRules: [
    {
      id: 'thief.opportune-opening',
      order: 8,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => 1 + balanceNumberFromContext(context, REWORK.OPPORTUNE_OPENING, 'damageIncrease'),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        [CONDITION.CRIPPLED, CONDITION.CHILLED, CONDITION.IMMOBILIZED].some((condition) =>
          targetConditionActive(context, condition)
        )
    }
  ]
});

/** Keep this shared completion listener in both rulesets, replacing movement endurance with Steal resistance. */
export const hardToCatch = defineTrait({
  id: TRAIT.HARD_TO_CATCH,
  name: 'Hard to Catch',
  balance: {
    effects: [
      {
        type: 'boon',
        name: BOON.RESISTANCE,
        boon: BOON.RESISTANCE,
        stacks: 1,
        duration: 3,
        audience: { recipients: RECIPIENT.SELF }
      }
    ]
  },
  triggers: [
    onTriggerPoint(thiefCastCompleted, {
      when: (_runtime, { cast }: ThiefCastCompletion) => Boolean(cast.skill.stealTraitSkill),
      run(runtime: ThiefRuntime, { cast }: ThiefCastCompletion) {
        emitTraitProfile(runtime, TRAIT.HARD_TO_CATCH, TRAIT.HARD_TO_CATCH, undefined, {
          at: runtime.time,
          activationId: cast.id,
          skillId: TRAIT.HARD_TO_CATCH,
          skillName: 'Hard to Catch'
        });
      }
    })
  ]
});

/** Each actual self swiftness application can grant endurance; permanent boon assumptions are not producers. */
export const dontStop = defineTrait({
  id: TRAIT.DONT_STOP,
  name: "Don't Stop",
  balance: { resourceGain: 0, internalCooldown: 0 },
  triggers: [
    {
      on: 'buff.applied',
      when: (runtime, event) =>
        (event.kind || '').toLowerCase() === boonKey(BOON.SWIFTNESS) &&
        Boolean(event.resolvedAudience?.includesSelf) &&
        balanceNumberFromContext(runtime, TRAIT.DONT_STOP, 'resourceGain') > 0,
      run(runtime: ThiefRuntime) {
        const cooldown = balanceNumberFromContext(runtime, TRAIT.DONT_STOP, 'internalCooldown');

        if (cooldown > 0 && !runtime.procs.claimCooldown(TRAIT.DONT_STOP, runtime.time, cooldown)) return;

        runtime.endurance.grant(balanceNumberFromContext(runtime, TRAIT.DONT_STOP, 'resourceGain'));
      }
    }
  ]
});

/** The extra strike uses the unequipped strength profile so it stays independent of the triggering weapon. */
export const sharpInitiation = defineTrait({
  id: REWORK.SHARP_INITIATION,
  name: 'Sharp Initiation',
  balance: {
    effects: [
      {
        type: 'strike',
        name: 'Sharp Initiation',
        coefficient: 0,
        weaponStrengthProfileId: 'nonweapon.unequipped',
        canCrit: true
      }
    ]
  }
});

// Successful incoming evades and healing stay outside the outgoing-damage model.
export const acrobaticsReworkTraits = [
  deftInitiation,
  felineGrace,
  opportuneOpening,
  hardToCatch,
  dontStop,
  sharpInitiation,
  defineTrait({ id: REWORK.ENDURANCE_TRAINING, name: 'Endurance Training' }),
  defineTrait({ id: TRAIT.ASSASSINS_REWARD, name: "Assassin's Reward" })
];
