import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { OBSERVABLE_EVENT_HANDLER } from '#gw2/platform/resolver/handler-registry.js';
import { activeBoonStacks, engineerRuntimeState } from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { isEngineerToolbeltSkill } from '#gw2/professions/engineer/core/traits/toolbelt.js';
import { resourceAtLeast } from '#gw2/platform/combat/resources/pool.js';
import { ENGINEER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/core/profiles.js';

/** Owns Streamlined Kits tuning and behavior at its established runtime and build boundaries. */
export const streamlinedKits = defineTrait({
  id: TRAIT.STREAMLINED_KITS,
  name: 'Streamlined Kits',
  balance: {
    internalCooldown: 20,
    effects: [
      { name: 'swiftness', type: 'boon', boon: 'swiftness', stacks: 1, duration: 20 },
      { name: 'Streamlined Kits', type: 'strike', coefficient: 1.75, hits: 1 }
    ]
  }
});

/** Owns Optimized Activation tuning and behavior at its established runtime and build boundaries. */
export const optimizedActivation = defineTrait({
  id: TRAIT.OPTIMIZED_ACTIVATION,
  name: 'Optimized Activation',
  balance: {
    effects: [{ name: 'vigor', type: 'boon', boon: 'vigor', stacks: 1, duration: 4 }]
  }
});

/** Owns Static Discharge tuning and behavior at its established runtime and build boundaries. */
export const staticDischarge = defineTrait({
  id: TRAIT.STATIC_DISCHARGE,
  name: 'Static Discharge',
  balance: {
    criticalDamage: 2,
    effects: [{ name: 'Static Discharge', type: 'strike', coefficient: 0.33, hits: 1 }]
  },
  modifierRules: [
    {
      order: -9,
      requiresSelection: false,
      // Static Discharge doubles its completed critical multiplier without affecting other strikes.
      id: 'engineer.static-discharge-critical-damage',
      target: MODIFIER_TARGET.CRITICAL_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.STATIC_DISCHARGE), 'criticalDamage'),
      when: (context) => context.event?.staticDischarge === true
    }
  ]
});

/** Owns Kinetic Battery tuning and behavior at its established runtime and build boundaries. */
export const kineticBattery = defineTrait({
  id: TRAIT.KINETIC_BATTERY,
  name: 'Kinetic Battery',
  balance: {
    maximumStacks: 5,
    effects: [
      { name: 'kinetic-battery', type: 'buff', kind: 'kinetic-battery', stacks: 1, duration: 5 },
      { name: 'quickness', type: 'boon', boon: 'quickness', stacks: 1, duration: 5 },
      // Superspeed accompanies the fifth charge without boon-duration scaling.
      { name: 'superspeed', type: 'buff', kind: 'superspeed', stacks: 1, duration: 5 }
    ]
  },
  modifierRules: [
    {
      order: -14,
      id: 'engineer.kinetic-battery',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.15,
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) && activeBoonStacks(context, 'kinetic-battery', 1) > 0
    }
  ],
  hooks: { eventHandlers: { 'engineer.kinetic-battery': OBSERVABLE_EVENT_HANDLER } }
});

/** Owns Adrenal Implant tuning and behavior at its established runtime and build boundaries. */
export const adrenalImplant = defineTrait({
  id: TRAIT.ADRENAL_IMPLANT,
  name: 'Adrenal Implant',
  balance: { rechargeReduction: 1 }
});

/** Owns Power Wrench tuning and behavior at its established runtime and build boundaries. */
export const powerWrench = defineTrait({
  id: TRAIT.POWER_WRENCH,
  name: 'Power Wrench',
  balance: { rechargeReduction: 3 }
});

/** Owns Gadgeteer tuning and behavior at its established runtime and build boundaries. */
export const gadgeteer = defineTrait({
  id: TRAIT.GADGETEER,
  name: 'Gadgeteer',
  balance: { rechargeMultiplier: 0.8 },
  rechargeRules: [
    {
      when: (runtime, skill) =>
        !(isEngineerToolbeltSkill(skill) && hasTrait(runtime, TRAIT.MECHANIZED_DEPLOYMENT)) &&
        Boolean(skill.categories?.some((category) => category.toLowerCase() === 'gadget')),
      multiplier: { profile: TRAIT.GADGETEER, field: 'rechargeMultiplier' }
    }
  ]
});

/** Owns Mechanized Deployment tuning and behavior at its established runtime and build boundaries. */
export const mechanizedDeployment = defineTrait({
  id: TRAIT.MECHANIZED_DEPLOYMENT,
  name: 'Mechanized Deployment',
  balance: { rechargeMultiplier: 0.85 },
  rechargeRules: [
    {
      when: (_runtime, skill) => isEngineerToolbeltSkill(skill),
      multiplier: { profile: TRAIT.MECHANIZED_DEPLOYMENT, field: 'rechargeMultiplier' }
    }
  ]
});

/** Owns Excessive Energy tuning and behavior at its established runtime and build boundaries. */
export const excessiveEnergy = defineTrait({
  id: TRAIT.EXCESSIVE_ENERGY,
  name: 'Excessive Energy',
  modifierRules: [
    {
      order: -16,
      id: 'engineer.excessive-energy',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.1,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && activeBoonStacks(context, 'vigor', 1) > 0
    }
  ]
});

/** Owns Takedown Round tuning and behavior at its established runtime and build boundaries. */
export const takedownRound = defineTrait({
  id: TRAIT.TAKEDOWN_ROUND,
  name: 'Takedown Round',
  modifierRules: [
    {
      order: -15,
      // Use the same endurance rule for live damage and isolated attribute previews.
      id: 'engineer.takedown-round',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.1,
      when: (context) => {
        const state = engineerRuntimeState(context);
        return (
          isGw2PlayerModifierOwnedEvent(context.event) &&
          !resourceAtLeast(
            state.endurance || 0,
            balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'maximumStacks')
          )
        );
      }
    }
  ]
});
