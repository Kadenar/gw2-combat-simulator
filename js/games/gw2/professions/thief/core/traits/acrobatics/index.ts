import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { buffActive, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { BOON, CONDITION, WEAPON } from '#gw2/platform/constants.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import {
  attributeBonusNumber,
  balanceNumber,
  balanceProfileNumber,
  requireBalanceProfile
} from '#gw2/platform/skills/balance-profiles.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { replaceThiefBuff } from '#gw2/professions/thief/core/mechanics/buffs.js';
import { consumeDeftInitiation } from '#gw2/professions/thief/core/mechanics/deft-initiation.js';
import {
  thiefCastCompleted,
  thiefMobilityUsed,
  thiefPostVenomStruck,
  type ThiefCastCompletion
} from '#gw2/professions/thief/core/mechanics/trigger-points.js';
import { THIEF_SKILL_IDS as SKILL, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

/** Owns Fluid Strikes tuning and behavior at the existing execution boundaries. */
export const fluidStrikes = defineTrait({
  id: TRAIT.FLUID_STRIKES,
  balance: {
    damageIncrease: 0.1,
    duration: 5
  },
  modifierRules: [
    {
      order: 8,
      id: 'thief.fluid-strikes',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: (context) => balanceNumber(context.catalog, TRAIT.FLUID_STRIKES, 'damageIncrease'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && buffActive(context, 'fluid-strikes')
    }
  ],
  triggers: [
    onTriggerPoint(thiefCastCompleted, {
      when: (_runtime, { cast }: ThiefCastCompletion) => Boolean(cast.skill.movementSkill),
      run: applyFluidStrikes
    })
  ]
});

/** Owns Swindler's Equilibrium tuning and behavior at the existing execution boundaries. */
export const swindlersEquilibrium = defineTrait({
  id: TRAIT.SWINDLERS_EQUILIBRIUM,
  balance: { attributeBonuses: { power: 120 }, conditionalAttributeBonuses: { power: 240 } },
  attributes({ loadout, weaponSet, balanceContext }) {
    const weapons = weaponSet === 2 ? loadout.alternateWeapons : loadout.weapons;
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Power',
          amount: attributeBonusNumber(
            balanceContext.catalog,
            TRAIT.SWINDLERS_EQUILIBRIUM,
            'power',
            weapons.includes(WEAPON.SWORD) ? 'conditionalAttributeBonuses' : 'attributeBonuses'
          ),
          feedsConversions: 'all'
        }
      ]
    };
  }
});

/** Owns Upper Hand tuning and behavior at the existing execution boundaries. */
export const upperHand = defineTrait({
  id: TRAIT.UPPER_HAND,
  balance: {
    internalCooldown: 2,
    resourceGain: 1
  },
  triggers: [
    onTriggerPoint(thiefCastCompleted, {
      when: (_runtime, { cast }: ThiefCastCompletion) => cast.skill.id === SHARED_SKILL_IDS.DODGE,
      run: applyUpperHand
    })
  ]
});

/** Applies Fluid Strikes at its established mechanical boundary. */
function applyFluidStrikes(runtime: ThiefRuntime): void {
  replaceThiefBuff(
    runtime,
    'fluid-strikes',
    balanceNumber(runtime.helpers, TRAIT.FLUID_STRIKES, 'duration'),
    TRAIT.FLUID_STRIKES,
    'Fluid Strikes',
    'Trait'
  );
}

/** Upper Hand claims its cooldown when a dodge completes, before its initiative can re-enter the trait. */
function applyUpperHand(runtime: ThiefRuntime): void {
  const profile = requireBalanceProfile(runtime.helpers, TRAIT.UPPER_HAND);

  if (runtime.procs.claimCooldown(TRAIT.UPPER_HAND, runtime.time, balanceProfileNumber(profile, 'internalCooldown'))) {
    const initiativeGain = balanceProfileNumber(profile, 'resourceGain');

    if (initiativeGain > 0) runtime.resourceController.grant('initiative', initiativeGain);
  }
}

/** Mark remains a Steal replacement, but its existing movement flag does not represent actual mobility. */
const mobilityEligible = (_runtime: unknown, { cast }: ThiefCastCompletion) => cast.skill.id !== SKILL.DEADEYES_MARK;

/** Combat entry and mobility arm one next-hit payload; unknown numbers stay in the selected profiles. */
export const deftInitiation = defineTrait({
  id: TRAIT.DEFT_INITIATION,
  balance: {
    internalCooldown: 0,
    // Leave the payload empty until its Might and Vulnerability tuning is confirmed.
    effects: []
  },
  triggers: [
    onTriggerPoint(thiefMobilityUsed, {
      when: mobilityEligible,
      run(runtime: ThiefRuntime) {
        runtime.profession.core.deftInitiationArmed = true;
      }
    }),
    onTriggerPoint(thiefPostVenomStruck, { run: consumeDeftInitiation })
  ]
});

/** Cause-free cast completion emits self swiftness explicitly; zero cooldown never merges same-instant grants. */
export const felineGrace = defineTrait({
  id: TRAIT.FELINE_GRACE,
  balance: {
    internalCooldown: 0,
    // Swiftness stays absent until its duration is confirmed.
    effects: []
  },
  triggers: [
    onTriggerPoint(thiefMobilityUsed, {
      when: mobilityEligible,
      run(runtime: ThiefRuntime, { cast }: ThiefCastCompletion) {
        const profile = requireBalanceProfile(runtime.helpers, TRAIT.FELINE_GRACE);

        if (!profile.effects?.some((effect) => effect.type === 'boon' && effect.boon === BOON.SWIFTNESS)) return;

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
  id: TRAIT.OPPORTUNE_OPENING,
  balance: {
    damageIncrease: 0,
    // Cripple stays absent until its duration is confirmed.
    effects: []
  },
  modifierRules: [
    {
      id: 'thief.opportune-opening',
      order: 8,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) => 1 + balanceNumber(context.catalog, TRAIT.OPPORTUNE_OPENING, 'damageIncrease'),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        [CONDITION.CRIPPLED, CONDITION.CHILLED, CONDITION.IMMOBILIZED].some((condition) =>
          targetConditionActive(context, condition)
        )
    }
  ]
});

/** Steal replaces the retired movement-endurance reward; Resistance duration remains pending. */
export const hardToCatch = defineTrait({
  id: TRAIT.HARD_TO_CATCH,
  balance: {
    // Resistance stays absent until its duration is confirmed.
    effects: []
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
  balance: { resourceGain: 0, internalCooldown: 0 },
  triggers: [
    {
      on: 'buff.applied',
      when: (runtime, event) =>
        (event.kind || '').toLowerCase() === BOON.SWIFTNESS &&
        Boolean(event.resolvedAudience?.includesSelf) &&
        balanceNumber(runtime.helpers, TRAIT.DONT_STOP, 'resourceGain') > 0,
      run(runtime: ThiefRuntime) {
        const cooldown = balanceNumber(runtime.helpers, TRAIT.DONT_STOP, 'internalCooldown');

        if (cooldown > 0 && !runtime.procs.claimCooldown(TRAIT.DONT_STOP, runtime.time, cooldown)) return;

        runtime.endurance.grant(balanceNumber(runtime.helpers, TRAIT.DONT_STOP, 'resourceGain'));
      }
    }
  ]
});

/** The extra strike uses the unequipped strength profile so it stays independent of the triggering weapon. */
export const sharpInitiation = defineTrait({
  id: TRAIT.SHARP_INITIATION,
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
export const newAcrobaticsTraits = [
  deftInitiation,
  felineGrace,
  opportuneOpening,
  hardToCatch,
  dontStop,
  sharpInitiation,
  defineTrait({ id: TRAIT.ENDURANCE_TRAINING }),
  defineTrait({ id: TRAIT.ASSASSINS_REWARD })
];
