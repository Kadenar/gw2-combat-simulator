import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { positional, rangerBoonActive } from '#gw2/professions/ranger/core/traits/modifier-queries.js';
import { RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import type { RangerRuntime } from '#gw2/professions/ranger/types.js';

/** Owns Light on Your Feet's live tuning and trait behavior. */
export const lightOnYourFeet = defineTrait({
  id: TRAIT.LIGHT_ON_YOUR_FEET,
  name: 'Light on Your Feet',
  balance: {
    conditionDurationBonus: 0.1,
    durationPerTier: 2,
    minimumStacks: 1,
    rechargeMultiplier: 0.8,
    effects: [
      { name: 'light-on-your-feet', type: 'buff', kind: 'light-on-your-feet', duration: 6, stacks: 1 },
      {
        name: 'Vulnerability',
        type: 'condition',
        condition: 'Vulnerability',
        duration: 10,
        stacks: 10
      }
    ]
  },
  modifierRules: [
    {
      order: 3,
      id: 'ranger.light-on-your-feet',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.1,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && rangerBoonActive(context, 'light-on-your-feet')
    },
    {
      order: 4,
      id: 'ranger.light-on-your-feet-condition-duration',
      target: MODIFIER_TARGET.CONDITION_DURATION,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.LIGHT_ON_YOUR_FEET),
          'conditionDurationBonus'
        ),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && rangerBoonActive(context, 'light-on-your-feet')
    }
  ],
  rechargeRules: [
    {
      order: 2,
      when: (_runtime, skill) => skill.weapon === 'Shortbow',
      multiplier: { profile: TRAIT.LIGHT_ON_YOUR_FEET, field: 'rechargeMultiplier' }
    }
  ]
});

/** Owns Tail Wind's live tuning and trait behavior. */
export const tailWind = defineTrait({
  id: TRAIT.TAIL_WIND,
  name: 'Tail Wind',
  balance: {
    internalCooldown: 9,
    effects: [{ name: 'swiftness', type: 'boon', boon: 'swiftness', duration: 9, stacks: 1 }]
  }
});

/** Owns Quick Draw's live tuning and trait behavior. */
export const quickDraw = defineTrait({
  id: TRAIT.QUICK_DRAW,
  name: 'Quick Draw',
  balance: {
    internalCooldown: 9,
    durationMultiplier: 5,
    rechargeMultiplier: 0.34,
    effects: [{ name: 'quickness', type: 'boon', boon: 'quickness', duration: 3, stacks: 1 }]
  },
  rechargeRules: [
    {
      order: 0,
      when: (runtime: RangerRuntime, skill) =>
        skill.type === 'Weapon' && skill.slot !== 'Weapon_1' && runtime.profession.core.quickDrawUntil > runtime.time,
      multiplier: { profile: TRAIT.QUICK_DRAW, field: 'rechargeMultiplier' }
    }
  ],
  hooks: {
    reserveRecharge(runtime: RangerRuntime, skill, work) {
      // Quick Draw is reserved at acceptance so concurrent casts cannot consume the same grant twice.
      if (skill.type === 'Weapon' && skill.slot !== 'Weapon_1' && runtime.profession.core.quickDrawUntil > runtime.time)
        runtime.profession.core.quickDrawUntil = 0;
      return work;
    }
  }
});

/** Owns Furious Grip's live tuning and trait behavior. */
export const furiousGrip = defineTrait({
  id: TRAIT.FURIOUS_GRIP,
  name: 'Furious Grip',
  balance: {
    internalCooldown: 9,
    effects: [{ name: 'fury', type: 'boon', boon: 'fury', duration: 5, stacks: 1 }]
  }
});

/** Owns Sharpened Edges's live tuning and trait behavior. */
export const sharpenedEdges = defineTrait({
  id: TRAIT.SHARPENED_EDGES,
  name: 'Sharpened Edges',
  balance: {
    criticalChance: 0.33,
    effects: [{ name: 'Bleeding', type: 'condition', condition: 'Bleeding', duration: 3, stacks: 1 }]
  }
});

/** Owns Trapper's Expertise's live tuning and trait behavior. */
export const trappersExpertise = defineTrait({
  id: TRAIT.TRAPPERS_EXPERTISE,
  name: "Trapper's Expertise",
  balance: {
    durationMultiplier: 1.6,
    coefficientMultiplier: 1.66,
    effects: [
      {
        name: 'Crippled',
        type: 'condition',
        condition: 'Crippled',
        duration: 3,
        stacks: 1
      }
    ]
  }
});

/** Owns Fang and Claw's live tuning and trait behavior. */
export const fangAndClaw = defineTrait({
  id: TRAIT.FANG_AND_CLAW,
  name: 'Fang and Claw',
  balance: {
    attributeBonus: 420,
    weaponAttributeBonus: 450
  }
});

/** Owns Strider's Strength's live tuning and trait behavior. */
export const stridersStrength = defineTrait({
  id: TRAIT.STRIDERS_STRENGTH,
  name: "Strider's Strength",
  balance: {
    weaponAttributeBonus: 240,
    attributeBonus: 120
  },
  buildAttributes: (_common, { balanceContext: profileContext, build, weaponSet }) => {
    const profile = requireBalanceProfileFromContext(profileContext, TRAIT.STRIDERS_STRENGTH);
    const weapons = (weaponSet === 2 ? build.alternateWeapons : build.weapons) || [];
    return {
      attributeEffects: [
        {
          kind: 'flat',
          source: "Strider's Strength",
          to: 'Power',
          amount: balanceProfileNumber(profile, weapons.includes('Sword') ? 'weaponAttributeBonus' : 'attributeBonus'),
          feedsConversions: false
        }
      ]
    };
  }
});

/** Owns Vicious Quarry's live tuning and trait behavior. */
export const viciousQuarry = defineTrait({
  id: TRAIT.VICIOUS_QUARRY,
  name: 'Vicious Quarry',
  balance: {
    criticalChance: 0.15,
    attributeBonus: 250
  },
  modifierRules: [
    {
      order: 5,
      id: 'ranger.vicious-quarry-critical-chance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.VICIOUS_QUARRY), 'criticalChance'),
      when: (context) => rangerBoonActive(context, 'fury')
    }
  ],
  buildAttributes: (_common, { balanceContext: profileContext, build }) => {
    const profile = requireBalanceProfileFromContext(profileContext, TRAIT.VICIOUS_QUARRY);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          source: 'Vicious Quarry',
          to: 'Ferocity',
          amount: balanceProfileNumber(profile, 'attributeBonus'),
          feedsConversions: false,
          enabled: build.assumptions?.fury !== false
        }
      ]
    };
  }
});

/** Owns Hunter's Tactics's live tuning and trait behavior. */
export const huntersTactics = defineTrait({
  id: TRAIT.HUNTERS_TACTICS,
  name: "Hunter's Tactics",
  balance: {
    criticalChance: 0.1
  },
  modifierRules: [
    {
      order: 1,
      id: 'ranger.hunters-tactics-damage',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.1,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && positional(context)
    },
    {
      order: 2,
      id: 'ranger.hunters-tactics-critical-chance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.HUNTERS_TACTICS), 'criticalChance'),
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && positional(context)
    }
  ]
});

/** Owns Hidden Barbs's live tuning and trait behavior. */
export const hiddenBarbs = defineTrait({
  id: TRAIT.HIDDEN_BARBS,
  name: 'Hidden Barbs',
  modifierRules: [
    {
      order: 12,
      id: 'ranger.hidden-barbs',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: 1.2,
      when: (context) => context.condition === 'Bleeding'
    }
  ]
});
