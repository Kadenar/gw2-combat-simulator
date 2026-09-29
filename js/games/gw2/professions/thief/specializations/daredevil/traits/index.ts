import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { thiefRuntimeSpecializationState, thiefRuntimeState } from '#gw2/professions/thief/core/modifiers.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { DAREDEVIL_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/daredevil/profiles.js';
import type { DaredevilState } from '#gw2/professions/thief/specializations/daredevil/state.js';

/** Owns Brawler's Tenacity tuning and behavior at the existing execution boundaries. */
export const brawlersTenacity = defineTrait({
  id: TRAIT.BRAWLERS_TENACITY,
  name: "Brawler's Tenacity",
  balance: {
    resourceGain: 15
  }
});

/** Owns Bounding Dodger tuning and behavior at the existing execution boundaries. */
export const boundingDodger = defineTrait({
  id: TRAIT.BOUNDING_DODGER,
  name: 'Bounding Dodger',
  modifierRules: [
    {
      order: 102,
      id: 'thief.bounding-dodger',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.15,
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        hasTrait(context, TRAIT.BOUNDING_DODGER) &&
        (thiefRuntimeSpecializationState<DaredevilState>(context, 'Daredevil').boundingDamageUntil || 0) > context.time
    }
  ],
  balance: {
    durationMultiplier: 6,
    effects: [{ type: 'strike', name: 'Bounding Dodger', coefficient: 3.5, hits: 1 }]
  }
});

/** Owns Lotus Training tuning and behavior at the existing execution boundaries. */
export const lotusTraining = defineTrait({
  id: TRAIT.LOTUS_TRAINING,
  name: 'Lotus Training',
  modifierRules: [
    {
      order: 103,
      id: 'thief.lotus-training',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'damage-additive',
      amount: 0.15,
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        hasTrait(context, TRAIT.LOTUS_TRAINING) &&
        (thiefRuntimeSpecializationState<DaredevilState>(context, 'Daredevil').lotusConditionDamageUntil || 0) >
          context.time
    }
  ],
  balance: {
    durationMultiplier: 6,
    effects: [
      {
        type: 'strike',
        name: 'Lotus Training',
        ticks: [
          { atMs: 200, coefficient: 0.1875 },
          { atMs: 360, coefficient: 0.1875 },
          { atMs: 520, coefficient: 0.1875 }
        ]
      },
      // Lotus conditions follow their individual projectiles from dodge start.
      { type: 'condition', name: 'Bleeding', atMs: 200, condition: 'Bleeding', stacks: 2, duration: 4 },
      { type: 'condition', name: 'Torment', atMs: 360, condition: 'Torment', stacks: 2, duration: 4 },
      { type: 'condition', name: 'Crippled', atMs: 520, condition: 'Crippled', stacks: 1, duration: 3 }
    ]
  }
});

/** Owns Unhindered Combatant tuning and behavior at the existing execution boundaries. */
export const unhinderedCombatant = defineTrait({
  id: TRAIT.UNHINDERED_COMBATANT,
  name: 'Unhindered Combatant',
  balance: {
    effects: [{ type: 'boon', name: 'Swiftness', boon: 'Swiftness', stacks: 1, duration: 8 }]
  }
});

/** Owns Endurance Thief tuning and behavior at the existing execution boundaries. */
export const enduranceThief = defineTrait({
  id: TRAIT.ENDURANCE_THIEF,
  name: 'Endurance Thief',
  balance: {
    resourceGain: 50
  }
});

/** Owns this trait's modifier eligibility. */
export const havocSpecialist = defineTrait({
  id: TRAIT.HAVOC_SPECIALIST,
  name: 'Havoc Specialist',
  modifierRules: [
    {
      order: 101,
      id: 'thief.havoc-specialist',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.15,
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        hasTrait(context, TRAIT.HAVOC_SPECIALIST) &&
        // Trait activates whenever endurance is not at maximum — any spent dodge qualifies
        (thiefRuntimeState(context).endurance || 0) <
          balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'maximumStacks')
    }
  ]
});

/** Owns Marauder's Resilience tuning and behavior at the existing execution boundaries. */
export const maraudersResilience = defineTrait({
  id: TRAIT.MARAUDERS_RESILIENCE,
  name: "Marauder's Resilience",
  balance: { attributeConversion: 0.07 },
  buildAttributes(_common, { balanceContext }) {
    const maraudersResilienceProfile = requireBalanceProfileFromContext(balanceContext, TRAIT.MARAUDERS_RESILIENCE);
    return {
      attributeEffects: [
        {
          kind: 'conversion',
          source: "Marauder's Resilience",
          from: 'Power',
          to: 'Vitality',
          multiplier: balanceProfileNumber(maraudersResilienceProfile, 'attributeConversion'),
          rounding: 'round',
          input: 'eligible'
        }
      ]
    };
  }
});

/** Owns Staff Master tuning and behavior at the existing execution boundaries. */
export const staffMaster = defineTrait({
  id: TRAIT.STAFF_MASTER,
  name: 'Staff Master',
  balance: {
    attributeBonus: 120,
    weaponAttributeBonus: 240,
    resourceGain: 2
  },
  buildAttributes(_common, { build, weaponSet, balanceContext }) {
    const weapons = (weaponSet === 2 ? build.alternateWeapons : build.weapons) || [];
    const staffMasterProfile = requireBalanceProfileFromContext(balanceContext, TRAIT.STAFF_MASTER);
    return {
      attributeEffects: [
        {
          kind: 'flat',
          source: 'Staff Master',
          to: 'Power',
          amount: balanceProfileNumber(
            staffMasterProfile,
            weapons.includes('Staff') ? 'weaponAttributeBonus' : 'attributeBonus'
          ),
          feedsConversions: true
        }
      ]
    };
  }
});

/** Owns Weakening Strikes tuning and behavior at the existing execution boundaries. */
export const weakeningStrikes = defineTrait({
  id: TRAIT.WEAKENING_STRIKES,
  name: 'Weakening Strikes',
  modifierRules: [
    {
      order: 100,
      id: 'thief.weakening-strikes',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.1,
      when: (context) =>
        isGw2PlayerModifierOwnedEvent(context.event) &&
        hasTrait(context, TRAIT.WEAKENING_STRIKES) &&
        targetConditionActive(context, 'Weakness')
    }
  ],
  balance: {
    durationMultiplier: 4,
    effects: [{ type: 'condition', name: 'Weakness', condition: 'Weakness', stacks: 1, duration: 3 }]
  }
});

/** Native trait owners, in stable authoring order. */
export const daredevilTraits = Object.freeze([
  boundingDodger,
  lotusTraining,
  unhinderedCombatant,
  enduranceThief,
  staffMaster,
  brawlersTenacity,
  maraudersResilience,
  weakeningStrikes,
  havocSpecialist
]);
