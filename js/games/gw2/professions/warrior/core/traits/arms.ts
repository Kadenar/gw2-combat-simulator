import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { eventSkill, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { warriorActiveBuffStacks, warriorBoonActive } from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';

/** Owns this trait's tuning and selected contributions. */
export const signetMastery = defineTrait({
  id: TRAIT.SIGNET_MASTERY,
  name: 'Signet Mastery',
  balance: {
    internalCooldown: 20,
    maximumStacks: 5,
    attributeBonus: 100,
    effects: [
      { name: 'might', type: 'boon', boon: 'might', stacks: 10, duration: 6 },
      { name: 'signet-mastery', type: 'buff', kind: 'signet-mastery', stacks: 1, duration: 60 }
    ]
  },
  triggers: [
    {
      order: 7,

      on: 'castCommit',
      when: (_runtime, cast) => Boolean(cast.skill.categories?.includes('Signet')),
      emit: TRAIT.SIGNET_MASTERY,
      effects: (effect) => effect.type === 'buff' && effect.kind === 'signet-mastery',
      attribution: { name: 'Signet Mastery', priority: 0 }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const burstPrecision = defineTrait({
  id: TRAIT.BURST_PRECISION,
  name: 'Burst Precision',
  balance: {
    criticalChance: 1,
    minimumStacks: 2,
    maximumStacks: 4,
    attributeBonus: 250
  },
  modifierRules: [
    {
      order: 6,
      id: 'warrior.burst-precision',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.BURST_PRECISION), 'criticalChance'),
      when: (context) =>
        Boolean(eventSkill(context)?.burst) || warriorActiveBuffStacks(context, 'burst-precision', 1) > 0
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const bloodlust = defineTrait({
  id: TRAIT.BLOODLUST,
  name: 'Bloodlust',
  balance: {
    conditionDurationBonus: 0.33,
    procRate: {
      id: 'warrior.bloodlust',
      traitId: TRAIT.BLOODLUST,
      field: 'procChance',
      opportunity: 'eligible critical hit'
    },
    procChance: 0.33,
    effects: [{ name: 'Bleeding', type: 'condition', condition: 'Bleeding', stacks: 1, duration: 3 }]
  },
  buildAttributes(_common, context) {
    return {
      traitDurations: {
        'Bleeding Duration':
          100 *
          balanceProfileNumber(
            requireBalanceProfileFromContext(context.balanceContext, TRAIT.BLOODLUST),
            'conditionDurationBonus'
          )
      }
    };
  }
});

/** Owns this trait's tuning and selected contributions. */
export const furious = defineTrait({
  id: TRAIT.FURIOUS,
  name: 'Furious',
  balance: {
    resourceGain: 1,
    maximumStacks: 25,
    attributeBonus: 15,
    effects: [{ name: 'furious-surge', type: 'buff', kind: 'furious-surge', stacks: 1, duration: 10 }]
  }
});

/** Owns this trait's tuning and selected contributions. */
export const sunderingBurst = defineTrait({
  id: TRAIT.SUNDERING_BURST,
  name: 'Sundering Burst',
  balance: {
    internalCooldown: 5,
    effects: [
      { name: 'Burst', type: 'condition', condition: 'Vulnerability', stacks: 5, duration: 8 },
      { name: 'Critical burst', type: 'condition', condition: 'Vulnerability', stacks: 10, duration: 8 }
    ]
  }
});

/** Owns this trait's tuning and selected contributions. */
export const opportunist = defineTrait({
  id: TRAIT.OPPORTUNIST,
  name: 'Opportunist',
  balance: {
    internalCooldown: 1,
    resourceGain: 5,
    effects: [{ name: 'fury', type: 'boon', boon: 'fury', stacks: 1, duration: 3 }]
  }
});

/** Owns this trait's tuning and selected contributions. */
export const furiousBurst = defineTrait({
  id: TRAIT.FURIOUS_BURST,
  name: 'Furious Burst',
  balance: {
    criticalChance: 0.05,
    internalCooldown: 4,
    effects: [{ name: 'fury', type: 'boon', boon: 'fury', stacks: 1, duration: 2.5 }]
  },
  modifierRules: [
    {
      order: 3,
      id: 'warrior.furious-burst-fury-critical-chance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FURIOUS_BURST), 'criticalChance'),
      when: (context) => warriorBoonActive(context, 'fury')
    }
  ],
  triggers: [
    {
      order: 5,

      on: 'castCommit',
      when: (_runtime, cast) => cast.skill.inputCategory === 'weapon-swap',
      emit: TRAIT.FURIOUS_BURST,
      icd: 'profile',
      effects: (effect) => effect.type === 'boon' && effect.name === 'fury',
      attribution: { name: 'Furious Burst' }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const deepStrikes = defineTrait({
  id: TRAIT.DEEP_STRIKES,
  name: 'Deep Strikes',
  balance: {
    criticalChance: 0.05,
    attributeBonus: 180
  },
  modifierRules: [
    {
      order: 4,
      id: 'warrior.deep-strikes',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.DEEP_STRIKES), 'criticalChance'),
      when: (context) => targetConditionActive(context, 'Bleeding')
    }
  ],
  buildAttributes(_common, context) {
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Condition Damage',
          amount: balanceProfileNumber(
            requireBalanceProfileFromContext(context.balanceContext, TRAIT.DEEP_STRIKES),
            'attributeBonus'
          ),
          feedsConversions: false,
          enabled: Boolean(context.build.assumptions?.fury)
        }
      ]
    };
  }
});

/** Owns this trait's tuning and selected contributions. */
export const unsuspectingFoe = defineTrait({
  id: TRAIT.UNSUSPECTING_FOE,
  name: 'Unsuspecting Foe',
  balance: {
    criticalChance: 0.25
  },
  modifierRules: [
    {
      order: 5,
      id: 'warrior.unsuspecting-foe',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.UNSUSPECTING_FOE), 'criticalChance'),
      when: (context) => Boolean(context.config?.target?.defiant)
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const woundingPrecision = defineTrait({
  id: TRAIT.WOUNDING_PRECISION,
  name: 'Wounding Precision',
  balance: { attributeConversion: 0.07 },
  buildAttributes(_common, context) {
    return {
      attributeEffects: [
        {
          kind: 'conversion',
          from: 'Precision',
          to: 'Expertise',
          multiplier: balanceProfileNumber(
            requireBalanceProfileFromContext(context.balanceContext, TRAIT.WOUNDING_PRECISION),
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

/** Owns this trait's tuning and selected contributions. */
export const blademaster = defineTrait({
  id: TRAIT.BLADEMASTER,
  name: 'Blademaster',
  balance: {
    rechargeMultiplier: 0.8,
    attributeBonus: 120
  },
  buildAttributes(_common, context) {
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Expertise',
          amount: balanceProfileNumber(
            requireBalanceProfileFromContext(context.balanceContext, TRAIT.BLADEMASTER),
            'attributeBonus'
          ),
          feedsConversions: false,
          enabled: true
        }
      ]
    };
  },
  rechargeRules: [
    {
      when: (_runtime, skill) => skill.weapon === 'Sword',
      multiplier: { profile: TRAIT.BLADEMASTER, field: 'rechargeMultiplier' }
    }
  ]
});

/** Select measured dual wield durations for the active offhand. */
export const dualWielding = defineTrait({
  id: TRAIT.DUAL_WIELDING,
  name: 'Dual Wielding',
  hooks: {
    castDurationMs(runtime, skill, durationMs) {
      const measured = Number(skill.dualWieldCastTimeMs);
      const offhand = gw2ConfiguredWeaponSet(runtime.config, runtime.activeWeaponSet)[1];
      return measured > 0 &&
        hasTrait(runtime, TRAIT.DUAL_WIELDING) &&
        ['Axe', 'Dagger', 'Mace', 'Sword'].includes(String(offhand))
        ? measured
        : durationMs;
    }
  }
});
