import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { eventSkill } from '#gw2/platform/combat/query/runtime-query.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { warriorBoonActive } from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';

/** Owns this trait's tuning and selected contributions. */
export const burstMastery = defineTrait({
  id: TRAIT.BURST_MASTERY,
  name: 'Burst Mastery',
  balance: {
    resourceGain: 0.33,
    effects: [{ name: 'swiftness', type: 'boon', boon: 'swiftness', stacks: 1, duration: 3 }]
  },
  modifierRules: [
    {
      id: 'warrior.burst-mastery',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.15,
      order: 100,
      when: (context) => hasTrait(context, TRAIT.BURST_MASTERY) && Boolean(eventSkill(context)?.burst)
    }
  ],
  profiles: [
    {
      id: 'warrior.bladesworn.burst-mastery',
      name: 'Bladesworn Burst Mastery Conversion',
      profileKind: 'mechanic',
      resourceGain: 0.2,
      effects: []
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const axeMastery = defineTrait({
  id: TRAIT.AXE_MASTERY,
  name: 'Axe Mastery',
  balance: {
    attributeBonus: 120,
    weaponAttributeBonus: 240,
    rechargeMultiplier: 0.8,
    resourceGain: 2
  },
  buildAttributes(_common, context) {
    const weapons = (context.weaponSet === 2 ? context.build.alternateWeapons : context.build.weapons) || [];
    return {
      attributeEffects: [
        {
          kind: 'flat',
          source: 'Axe Mastery',
          to: 'Ferocity',
          amount: balanceProfileNumber(
            requireBalanceProfileFromContext(context.balanceContext, TRAIT.AXE_MASTERY),
            weapons.includes('Axe') ? 'weaponAttributeBonus' : 'attributeBonus'
          ),
          feedsConversions: false,
          enabled: true
        }
      ]
    };
  },
  rechargeRules: [
    {
      when: (_runtime, skill) => skill.weapon === 'Axe',
      multiplier: { profile: TRAIT.AXE_MASTERY, field: 'rechargeMultiplier' }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const versatileRage = defineTrait({
  id: TRAIT.VERSATILE_RAGE,
  name: 'Versatile Rage',
  balance: { resourceGain: 5 }
});

/** Owns this trait's tuning and selected contributions. */
export const versatilePower = defineTrait({
  id: TRAIT.VERSATILE_POWER,
  name: 'Versatile Power',
  balance: { rechargeMultiplier: 0.85 },
  rechargeRules: [
    {
      order: -1,
      when: (_runtime, skill) => Boolean(skill.burst),
      multiplier: { profile: TRAIT.VERSATILE_POWER, field: 'rechargeMultiplier' }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const warriorsSprint = defineTrait({
  id: TRAIT.WARRIORS_SPRINT,
  name: "Warrior's Sprint",
  modifierRules: [
    {
      order: 7,
      id: 'warrior.warriors-sprint',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.1,
      when: (context) => hasTrait(context, TRAIT.WARRIORS_SPRINT) && warriorBoonActive(context, 'swiftness')
    }
  ]
});
