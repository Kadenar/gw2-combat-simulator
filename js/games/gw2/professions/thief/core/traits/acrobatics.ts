import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { thiefRuntimeState } from '#gw2/professions/thief/core/state-queries.js';
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
  modifierRules: [
    {
      order: 8,
      id: 'thief.fluid-strikes',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.1,
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        (thiefRuntimeState(context).fluidStrikesUntil || 0) > context.time
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
  balance: {
    internalCooldown: 2,
    resourceGain: 1
  }
});
