import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { warriorActiveBuffStacks } from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';

/** Owns this trait's tuning and selected contributions. */
export const berserkersPower = defineTrait({
  id: TRAIT.BERSERKERS_POWER,
  name: "Berserker's Power",
  balance: {
    // Damage, presentation, and tooltip consumers share this trait's balance values.
    maximumStacks: 4,
    damageIncreasePerStack: 0.0375,
    effects: [{ name: 'berserkers-power', type: 'buff', kind: 'berserkers-power', stacks: 1, duration: 15 }]
  },
  modifierRules: [
    {
      order: 1,
      id: 'warrior.berserkers-power',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      // The profile owns tuning; this rule only applies the capped-stack damage formula.
      amount: (context) => {
        const profile = requireBalanceProfileFromContext(context, TRAIT.BERSERKERS_POWER);
        return (
          warriorActiveBuffStacks(context, 'berserkers-power', balanceProfileNumber(profile, 'maximumStacks')) *
          balanceProfileNumber(profile, 'damageIncreasePerStack')
        );
      }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const recklessDodge = defineTrait({
  id: TRAIT.RECKLESS_DODGE,
  name: 'Reckless Dodge',
  balance: {
    effects: [
      { name: 'Strike', type: 'strike', coefficient: 1.5, hits: 1 },
      { name: 'might', type: 'boon', boon: 'might', stacks: 2, duration: 5 }
    ]
  },
  triggers: [
    {
      order: 3,

      on: 'castCommit',
      when: (_runtime, cast) => cast.skill.id === SHARED_SKILL_IDS.DODGE,
      emit: TRAIT.RECKLESS_DODGE,
      effects: (effect) => effect.type === 'strike' && effect.name === 'Strike',
      attribution: { source: 'Warrior', actorType: 'player', name: 'Reckless Dodge', skillWeapon: '' }
    },
    {
      order: 4,

      on: 'castCommit',
      when: (_runtime, cast) => cast.skill.id === SHARED_SKILL_IDS.DODGE,
      emit: TRAIT.RECKLESS_DODGE,
      effects: (effect) => effect.type === 'boon' && effect.name === 'might',
      attribution: { name: 'Reckless Dodge — Might', priority: 0 }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const braveStride = defineTrait({
  id: TRAIT.BRAVE_STRIDE,
  name: 'Brave Stride',
  balance: {
    resourceGain: 5,
    effects: [{ name: 'stability', type: 'boon', boon: 'stability', stacks: 1, duration: 5 }]
  }
});

/** Owns this trait's tuning and selected contributions. */
export const peakPerformance = defineTrait({
  id: TRAIT.PEAK_PERFORMANCE,
  name: 'Peak Performance',
  balance: {
    effects: [{ name: 'peak-performance', type: 'buff', kind: 'peak-performance', stacks: 1, duration: 6 }]
  },
  modifierRules: [
    {
      order: 2,
      id: 'warrior.peak-performance',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      parameters: {
        baseBonus: 0.05,
        activeBonus: 0.1
      },
      amount: (context, _target, parameters) =>
        parameters.baseBonus + (warriorActiveBuffStacks(context, 'peak-performance', 1) ? parameters.activeBonus : 0)
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const bodyBlow = defineTrait({
  id: TRAIT.BODY_BLOW,
  name: 'Body Blow',
  balance: {
    effects: [
      { name: 'Weakness', type: 'condition', condition: 'Weakness', stacks: 1, duration: 3 },
      { name: 'Vulnerability', type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 6 }
    ]
  },
  triggers: [
    {
      order: 1,

      on: 'control.resolved',
      when: (_runtime, event) =>
        event.actorType === 'player' &&
        ['stun', 'daze', 'knockback', 'pull', 'push', 'launch'].includes(String(event.controlKind).toLowerCase()),
      emit: TRAIT.BODY_BLOW,
      attribution: { priority: 5 }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const aggressiveOnslaught = defineTrait({
  id: TRAIT.AGGRESSIVE_ONSLAUGHT,
  name: 'Aggressive Onslaught',
  balance: {
    internalCooldown: 0.32,
    effects: [{ name: 'quickness', type: 'boon', boon: 'quickness', stacks: 1, duration: 3 }]
  },
  triggers: [
    {
      order: 2,

      on: 'control.resolved',
      when: (_runtime, event) => event.actorType === 'player',
      emit: TRAIT.AGGRESSIVE_ONSLAUGHT,
      icd: 'profile',
      attribution: { priority: 5 }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const buildingMomentum = defineTrait({
  id: TRAIT.BUILDING_MOMENTUM,
  name: 'Building Momentum',
  balance: {
    resourceGain: 15
  }
});

/** Owns this trait's tuning and selected contributions. */
export const pinnacleOfStrength = defineTrait({
  id: TRAIT.PINNACLE_OF_STRENGTH,
  name: 'Pinnacle of Strength',
  balance: {
    criticalChance: 0.05,
    attributeBonus: 10
  },
  modifierRules: [
    {
      order: 0,
      id: 'warrior.pinnacle-critical-chance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.PINNACLE_OF_STRENGTH), 'criticalChance')
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const forcefulGreatsword = defineTrait({
  id: TRAIT.FORCEFUL_GREATSWORD,
  name: 'Forceful Greatsword',
  balance: {
    rechargeMultiplier: 0.8,
    attributeBonus: 120,
    weaponAttributeBonus: 120,
    // Critical Might has twice the proc chance while wielding a greatsword.
    procChance: 0.5,
    effects: [{ name: 'might', type: 'boon', boon: 'might', stacks: 1, duration: 5 }]
  },
  buildAttributes(_common, context) {
    const weapons = (context.weaponSet === 2 ? context.build.alternateWeapons : context.build.weapons) || [];
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Power',
          amount: balanceProfileNumber(
            requireBalanceProfileFromContext(context.balanceContext, TRAIT.FORCEFUL_GREATSWORD),
            'attributeBonus'
          ),
          feedsConversions: true,
          enabled: true
        },
        {
          kind: 'flat',
          to: 'Power',
          amount: balanceProfileNumber(
            requireBalanceProfileFromContext(context.balanceContext, TRAIT.FORCEFUL_GREATSWORD),
            'weaponAttributeBonus'
          ),
          feedsConversions: false,
          enabled: weapons.includes('Greatsword')
        }
      ]
    };
  },
  rechargeRules: [
    {
      when: (_runtime, skill) => skill.weapon === 'Greatsword',
      multiplier: { profile: TRAIT.FORCEFUL_GREATSWORD, field: 'rechargeMultiplier' }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const greatFortitude = defineTrait({
  id: TRAIT.GREAT_FORTITUDE,
  name: 'Great Fortitude',
  balance: {
    attributeConversion: 0.1
  },
  buildAttributes(_common, context) {
    return {
      attributeEffects: [
        {
          kind: 'conversion',
          from: 'Power',
          to: 'Vitality',
          multiplier: balanceProfileNumber(
            requireBalanceProfileFromContext(context.balanceContext, TRAIT.GREAT_FORTITUDE),
            'attributeConversion'
          ),
          rounding: 'none',
          input: 'eligible',
          enabled: true
        },
        {
          kind: 'conversion',
          from: 'Power',
          to: 'Ferocity',
          multiplier: balanceProfileNumber(
            requireBalanceProfileFromContext(context.balanceContext, TRAIT.GREAT_FORTITUDE),
            'attributeConversion'
          ),
          rounding: 'none',
          input: 'eligible',
          enabled: true
        }
      ]
    };
  }
});
