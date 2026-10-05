import { activeBuffStacks } from '#gw2/platform/combat/query/runtime-query.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { resetExplosiveEntrance } from '#gw2/professions/engineer/core/traits/explosions.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { playerHealthFraction, targetHealthFraction } from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { vulnerabilityStacks } from '#gw2/platform/combat/query/runtime-query.js';

/** Owns Grenadier tuning and behavior at its established runtime and build boundaries. */
export const grenadier = defineTrait({
  id: TRAIT.GRENADIER,
  name: 'Grenadier',
  balance: {
    internalCooldown: 20,
    // The canonical coefficient is the total across all six half-coefficient grenades.
    effects: [{ name: 'Grenadier', type: 'strike', coefficient: 3, hits: 6, atMs: 0 }]
  }
});

/** Owns Explosive Entrance tuning and behavior at its established runtime and build boundaries. */
export const explosiveEntrance = defineTrait({
  id: TRAIT.EXPLOSIVE_ENTRANCE,
  name: 'Explosive Entrance',
  balance: {
    effects: [{ name: 'Explosive Entrance', type: 'strike', coefficient: 1.25, hits: 1 }]
  },
  hooks: { eventHandlers: { 'engineer.dodge': resetExplosiveEntrance } }
});

/** Owns Steel-Packed Powder tuning and behavior at its established runtime and build boundaries. */
export const steelPackedPowder = defineTrait({
  id: TRAIT.STEEL_PACKED_POWDER,
  name: 'Steel-Packed Powder',
  balance: {
    effects: [{ name: 'Vulnerability', type: 'condition', condition: 'Vulnerability', stacks: 1, duration: 5 }]
  }
});

/** Owns Short Fuse tuning and behavior at its established runtime and build boundaries. */
export const shortFuse = defineTrait({
  id: TRAIT.SHORT_FUSE,
  name: 'Short Fuse',
  balance: {
    internalCooldown: 3,
    effects: [{ name: 'fury', type: 'boon', boon: 'fury', stacks: 1, duration: 4 }]
  }
});

/** Owns Explosive Temper tuning and behavior at its established runtime and build boundaries. */
export const explosiveTemper = defineTrait({
  id: TRAIT.EXPLOSIVE_TEMPER,
  name: 'Explosive Temper',
  balance: {
    maximumStacks: 10,
    attributePerStack: 20,
    effects: [{ name: 'explosive-temper', type: 'buff', kind: 'explosive-temper', stacks: 1, duration: 10 }]
  }
});

/** Owns Shrapnel tuning and behavior at its established runtime and build boundaries. */
export const shrapnel = defineTrait({
  id: TRAIT.SHRAPNEL,
  name: 'Shrapnel',
  balance: {
    procRate: {
      id: 'engineer.shrapnel',
      traitId: TRAIT.SHRAPNEL,
      field: 'procChance',
      opportunity: 'eligible explosion hit'
    },
    procChance: 0.33,
    effects: [
      { name: 'Bleeding', type: 'condition', condition: 'Bleeding', stacks: 1, duration: 6 },
      { name: 'Crippled', type: 'condition', condition: 'Crippled', stacks: 1, duration: 1 }
    ]
  }
});

/** Owns Aim-Assisted Rocket tuning and behavior at its established runtime and build boundaries. */
export const aimAssistedRocket = defineTrait({
  id: TRAIT.AIM_ASSISTED_ROCKET,
  name: 'Aim-Assisted Rocket',
  balance: {
    internalCooldown: 3,
    maximumStacks: 5,
    effects: [
      {
        name: 'Rocket',
        type: 'strike',
        coefficient: 1,
        hits: 1,
        atMs: 40,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        name: 'Orbital Strike',
        type: 'strike',
        coefficient: 1.92,
        hits: 1,
        atMs: 2000,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ]
  }
});

/** Owns Grand Entrance tuning and behavior at its established runtime and build boundaries. */
export const grandEntrance = defineTrait({
  id: TRAIT.GRAND_ENTRANCE,
  name: 'Grand Entrance',
  balance: {
    criticalChance: 0.1
  },
  modifierRules: [
    {
      order: -12,
      id: 'engineer.grand-entrance',
      target: MODIFIER_TARGET.CRITICAL_CHANCE,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.GRAND_ENTRANCE), 'criticalChance'),
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) && activeBuffStacks(context, 'grand-entrance', 1) > 0
    }
  ]
});

/** Owns Blast Shield tuning and behavior at its established runtime and build boundaries. */
export const blastShield = defineTrait({
  id: TRAIT.BLAST_SHIELD,
  name: 'Blast Shield',
  balance: { attributeConversion: 0.1 },
  buildAttributes: traitAttributeEffects(TRAIT.BLAST_SHIELD, [
    {
      kind: 'conversion',
      from: 'Power',
      to: 'Vitality',
      field: 'attributeConversion',
      rounding: 'none',
      input: 'eligible'
    }
  ])
});

/** Owns Glass Cannon tuning and behavior at its established runtime and build boundaries. */
export const glassCannon = defineTrait({
  id: TRAIT.GLASS_CANNON,
  name: 'Glass Cannon',
  modifierRules: [
    {
      order: -20,
      id: 'engineer.glass-cannon',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.07,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event) && playerHealthFraction(context) > 0.75
    }
  ]
});

/** Owns Big Boomer tuning and behavior at its established runtime and build boundaries. */
export const bigBoomer = defineTrait({
  id: TRAIT.BIG_BOOMER,
  name: 'Big Boomer',
  modifierRules: [
    {
      order: -19,
      id: 'engineer.big-boomer',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.15,
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) && playerHealthFraction(context) > targetHealthFraction(context)
    }
  ]
});

/** Owns Shaped Charge tuning and behavior at its established runtime and build boundaries. */
export const shapedCharge = defineTrait({
  id: TRAIT.SHAPED_CHARGE,
  name: 'Shaped Charge',
  modifierRules: [
    {
      order: -18,
      // caps at 25 stacks to match the in-game vulnerability stack cap
      id: 'engineer.shaped-charge',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      parameters: {
        maximumStacks: 25,
        damagePerStack: 0.005
      },
      factor: (context, _target, parameters) =>
        1 + Math.min(parameters.maximumStacks, vulnerabilityStacks(context)) * parameters.damagePerStack,
      when: (context) => isGw2PlayerModifierOwnedEvent(context.event)
    }
  ]
});
