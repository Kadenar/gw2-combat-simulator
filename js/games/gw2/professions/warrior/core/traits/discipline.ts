import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { eventSkill } from '#gw2/platform/combat/query/runtime-query.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { readyHeightenedFocusBurst, triggerHeightenedFocus } from '#gw2/professions/warrior/core/traits/behavior.js';
import { warriorBoonActive } from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';

/** Enhance the ranged autoattacks, applying Burning separately for each Dual Shot arrow that hits. */
export const crackShot = defineTrait({
  id: TRAIT.CRACK_SHOT,
  name: 'Crack Shot',
  balance: {
    effects: [{ name: 'Burning', type: 'condition', condition: 'Burning', stacks: 1, duration: 1 }]
  },
  modifierRules: [
    {
      id: 'warrior.crack-shot',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.1,
      when: (context) => eventSkill(context)?.id === ID.FIERCE_SHOT
    }
  ],
  triggers: [
    {
      on: 'damage.resolved',
      when: (_runtime, event) =>
        event.actorType === 'player' && event.skillId === ID.DUAL_SHOT && Number(event.coefficient) > 0,
      emit: TRAIT.CRACK_SHOT
    }
  ]
});

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
      when: (context) => Boolean(eventSkill(context)?.burst)
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

/** Reduce burst recharge, including Dragon Trigger, which owns the recharge for Dragon Slash. */
export const versatilePower = defineTrait({
  id: TRAIT.VERSATILE_POWER,
  name: 'Versatile Power',
  balance: { rechargeMultiplier: 0.85 },
  rechargeRules: [
    {
      order: -1,
      when: (_runtime, skill) => Boolean(skill.burst) || skill.id === ID.DRAGON_TRIGGER,
      multiplier: { profile: TRAIT.VERSATILE_POWER, field: 'rechargeMultiplier' }
    }
  ]
});

/** Owns Heightened Focus's execute-range Quickness and Burst recharge; its healing stacks are out of scope. */
export const heightenedFocus = defineTrait({
  id: TRAIT.HEIGHTENED_FOCUS,
  name: 'Heightened Focus',
  balance: {
    internalCooldown: 12,
    effects: [{ name: 'quickness', type: 'boon', boon: 'quickness', stacks: 1, duration: 5 }]
  },
  hooks: {
    reactions: { 'damage.resolved': triggerHeightenedFocus },
    onCastCommit: readyHeightenedFocusBurst
  }
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
      when: (context) => warriorBoonActive(context, 'swiftness')
    }
  ]
});
