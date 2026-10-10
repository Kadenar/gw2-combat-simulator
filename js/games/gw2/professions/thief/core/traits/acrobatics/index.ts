import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { buffActive } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';
import { thiefCastCompleted, type ThiefCastCompletion } from '#gw2/professions/thief/core/mechanics/boundaries.js';
import { replaceThiefBuff } from '#gw2/professions/thief/core/mechanics/buffs.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

/** Every accepted dodge grants self Might immediately, including selected dodge variants. */
export const pumpingUp = defineTrait({
  id: TRAIT.PUMPING_UP,
  name: 'Pumping Up',
  balance: {
    effects: [{ type: 'boon', name: 'Might', boon: 'might', stacks: 3, duration: 20, audience: { recipients: 'self' } }]
  },
  triggers: [
    {
      on: 'castStart',
      when: (_runtime, cast) => cast.skill.id === SHARED_SKILL_IDS.DODGE,
      emit: TRAIT.PUMPING_UP,
      attribution: (_runtime, cast) => ({
        skillId: TRAIT.PUMPING_UP,
        skillName: 'Pumping Up',
        triggeredBy: cast.skill.name
      })
    }
  ]
});

/** Owns Fluid Strikes tuning and behavior at the existing execution boundaries. */
export const fluidStrikes = defineTrait({
  id: TRAIT.FLUID_STRIKES,
  name: 'Fluid Strikes',
  triggers: [
    onTriggerPoint(thiefCastCompleted, {
      when: (_runtime, { cast }: ThiefCastCompletion) => Boolean(cast.skill.movementSkill),
      run: applyFluidStrikes
    })
  ],
  modifierRules: [
    {
      order: 8,
      id: 'thief.fluid-strikes',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.1,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && buffActive(context, 'fluid-strikes')
    }
  ],
  balance: {
    durationMultiplier: 5
  }
});

/** Owns Hard to Catch tuning and behavior at the existing execution boundaries. */
export const hardToCatch = defineTrait({
  id: TRAIT.HARD_TO_CATCH,
  name: 'Hard to Catch',
  triggers: [
    onTriggerPoint(thiefCastCompleted, {
      when: (_runtime, { cast }: ThiefCastCompletion) => Boolean(cast.skill.movementSkill),
      run: applyHardToCatch
    })
  ],
  balance: {
    resourceGain: 8
  }
});

/** Owns Swindler's Equilibrium tuning and behavior at the existing execution boundaries. */
export const swindlersEquilibrium = defineTrait({
  id: TRAIT.SWINDLERS_EQUILIBRIUM,
  name: "Swindler's Equilibrium",
  balance: { attributeBonus: 120, weaponAttributeBonus: 240 },
  buildAttributes(_common, { build, weaponSet, balanceContext }) {
    const weapons = (weaponSet === 2 ? build.alternateWeapons : build.weapons) || [];
    const swindlersEquilibriumProfile = requireBalanceProfileFromContext(balanceContext, TRAIT.SWINDLERS_EQUILIBRIUM);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Power',
          amount: balanceProfileNumber(
            swindlersEquilibriumProfile,
            weapons.includes('Sword') ? 'weaponAttributeBonus' : 'attributeBonus'
          ),
          feedsConversions: true
        }
      ]
    };
  }
});

/** Owns Upper Hand tuning and behavior at the existing execution boundaries. */
export const upperHand = defineTrait({
  id: TRAIT.UPPER_HAND,
  name: 'Upper Hand',
  triggers: [
    onTriggerPoint(thiefCastCompleted, {
      when: (_runtime, { cast }: ThiefCastCompletion) => cast.skill.id === SHARED_SKILL_IDS.DODGE,
      run: applyUpperHand
    })
  ],
  balance: {
    internalCooldown: 2,
    resourceGain: 1
  }
});

/** Applies Fluid Strikes at its established mechanical boundary. */
function applyFluidStrikes(runtime: ThiefRuntime): void {
  replaceThiefBuff(
    runtime,
    'fluid-strikes',
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.FLUID_STRIKES), 'durationMultiplier'),
    TRAIT.FLUID_STRIKES,
    'Fluid Strikes',
    'Trait'
  );
}

/** Applies Hard to Catch at its established mechanical boundary. */
function applyHardToCatch(runtime: ThiefRuntime): void {
  const enduranceGain = balanceProfileNumber(
    requireBalanceProfileFromContext(runtime, TRAIT.HARD_TO_CATCH),
    'resourceGain'
  );
  if (enduranceGain > 0) runtime.endurance.grant(enduranceGain);
}

/** Upper Hand claims its cooldown when a dodge completes, before its initiative can re-enter the trait. */
function applyUpperHand(runtime: ThiefRuntime): void {
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.UPPER_HAND);
  if (runtime.procs.claimCooldown(TRAIT.UPPER_HAND, runtime.time, balanceProfileNumber(profile, 'internalCooldown'))) {
    const initiativeGain = balanceProfileNumber(profile, 'resourceGain');
    if (initiativeGain > 0) runtime.resourceController.grant('initiative', initiativeGain);
  }
}
