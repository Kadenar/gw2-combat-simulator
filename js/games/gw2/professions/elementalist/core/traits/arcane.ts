import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { OBSERVABLE_EVENT_HANDLER } from '#gw2/platform/resolver/handler-registry.js';
import { elementalistTimedBuffStacks } from '#gw2/professions/elementalist/core/mechanics/modifier-queries.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';

/** Arcane definitions keep active tuning beside their behavior; explicit calls preserve mechanic ordering. */
export const arcaneProwess = defineTrait({
  id: TRAIT.ARCANE_PROWESS,
  name: 'Arcane Prowess',
  balance: {
    effects: [{ type: 'boon', name: 'Might', boon: 'might', stacks: 1, duration: 8 }]
  }
});

export const arcanePrecision = defineTrait({
  id: TRAIT.ARCANE_PRECISION,
  name: 'Arcane Precision',
  balance: {
    procChance: 0.33,
    internalCooldown: 3,
    effects: [
      { type: 'condition', name: 'Fire', condition: 'Burning', stacks: 1, duration: 1.5 },
      { type: 'condition', name: 'Water', condition: 'Vulnerability', stacks: 1, duration: 10 },
      { type: 'condition', name: 'Air', condition: 'Weakness', stacks: 1, duration: 3 },
      { type: 'condition', name: 'Earth', condition: 'Bleeding', stacks: 1, duration: 5 }
    ]
  }
});

export const renewingStamina = defineTrait({
  id: TRAIT.RENEWING_STAMINA,
  name: 'Renewing Stamina',
  balance: {
    internalCooldown: 10,
    effects: [{ type: 'boon', name: 'Vigor', boon: 'vigor', stacks: 1, duration: 5 }]
  }
});

export const elementalAttunement = defineTrait({
  id: TRAIT.ELEMENTAL_ATTUNEMENT,
  name: 'Elemental Attunement',
  balance: {
    effects: [
      { type: 'boon', name: 'Fire', boon: 'might', stacks: 1, duration: 15 },
      { type: 'boon', name: 'Water', boon: 'regeneration', stacks: 1, duration: 5 },
      { type: 'boon', name: 'Air', boon: 'swiftness', stacks: 1, duration: 8 },
      { type: 'boon', name: 'Earth', boon: 'protection', stacks: 1, duration: 5 }
    ]
  }
});

export const elementalLockdown = defineTrait({
  id: TRAIT.ELEMENTAL_LOCKDOWN,
  name: 'Elemental Lockdown',
  balance: {
    internalCooldown: 1,
    effects: [
      { type: 'boon', name: 'Fire', boon: 'might', stacks: 5, duration: 5 },
      { type: 'boon', name: 'Water', boon: 'regeneration', stacks: 1, duration: 10 },
      { type: 'boon', name: 'Air', boon: 'fury', stacks: 1, duration: 5 },
      { type: 'boon', name: 'Earth', boon: 'protection', stacks: 1, duration: 4 }
    ]
  }
});

export const elementalEnchantment = defineTrait({
  id: TRAIT.ELEMENTAL_ENCHANTMENT,
  name: 'Elemental Enchantment',
  rechargeRules: [
    {
      when: (_runtime, skill) => Boolean(skill.overload) || skill.skillFamily === 'Jade Sphere',
      multiplier: { profile: TRAIT.ELEMENTAL_ENCHANTMENT, field: 'rechargeMultiplier' }
    }
  ],
  balance: {
    attributeBonus: 180,
    rechargeMultiplier: 0.85
  },
  buildAttributes: (_common, { balanceContext }) => {
    const profile = requireBalanceProfileFromContext(balanceContext, TRAIT.ELEMENTAL_ENCHANTMENT);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Concentration',
          amount: balanceProfileNumber(profile, 'attributeBonus'),
          feedsConversions: false
        }
      ]
    };
  }
});

export const evasiveArcana = defineTrait({
  id: TRAIT.EVASIVE_ARCANA,
  name: 'Evasive Arcana',
  hooks: { eventHandlers: { 'elementalist.evasive-arcana': OBSERVABLE_EVENT_HANDLER } },
  balance: {
    internalCooldown: 10,
    effects: [
      {
        type: 'strike',
        name: 'Fire',
        coefficient: 1,
        hits: 1
      },
      { type: 'condition', name: 'Fire Burning', condition: 'Burning', stacks: 3, duration: 6 },
      { type: 'strike', name: 'Earth', coefficient: 0.5, hits: 1 },
      { type: 'condition', name: 'Earth Bleeding', condition: 'Bleeding', stacks: 1, duration: 20 },
      { type: 'condition', name: 'Earth Cripple', condition: 'Crippled', stacks: 1, duration: 2 }
    ]
  }
});

export const arcaneLightning = defineTrait({
  id: TRAIT.ARCANE_LIGHTNING,
  name: 'Arcane Lightning',
  balance: {
    attributeBonus: 150,
    effects: [
      {
        type: 'buff',
        name: 'Arcane Lightning',
        kind: 'arcane-lightning',
        stacks: 1,
        duration: 15
      },
      { type: 'boon', name: 'Arcane Brilliance', boon: 'protection', stacks: 1, duration: 3.5 },
      { type: 'condition', name: 'Arcane Wave', condition: 'Immobilized', stacks: 1, duration: 2 },
      { type: 'boon', name: 'Arcane Echo', boon: 'quickness', stacks: 1, duration: 4 }
    ]
  }
});

export const bountifulPower = defineTrait({
  id: TRAIT.BOUNTIFUL_POWER,
  name: 'Bountiful Power',
  balance: {
    threshold: 5,
    effects: [
      { type: 'boon', name: 'Quickness', boon: 'quickness', stacks: 1, duration: 5 },
      {
        type: 'buff',
        name: 'Damage Window',
        kind: 'bountiful-power-active',
        stacks: 1,
        duration: 7
      }
    ]
  },
  modifierRules: [
    {
      id: 'elementalist.bountiful-power',
      // Keep the original additive rule order before the registered Persisting Flames contribution.
      order: -12,
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.2,
      when: (context) => elementalistTimedBuffStacks(context, 'bountiful power active', 1) > 0
    }
  ]
});
