/**
 * Data-driven balance tunables for Evoker.
 *
 * Every retunable number the mechanics read (charge caps, ICDs, familiar delays
 * and interrupt windows, trait boons, recharge multipliers) lives here as a
 * balance profile, so patch adjustments are data edits rather than code edits.
 * Code looks values up through `balanceProfileValueFromContext`/`Effect`, with the
 * literal at the call site acting only as a fallback.
 */
import type { BalanceProfile, SkillEffect } from '#gw2/platform/engine/types.js';
import {
  defineSkillVariantProfile as variant,
  defineTraitProfile as trait
} from '#gw2/platform/profession-definition/balance-profiles.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';

/**
 * Stable lookup keys for Evoker's profiles. Trait-backed entries reuse the trait
 * id so the profile resolves against the selected trait.
 */
export const EVOKER_BALANCE_PROFILE_IDS = Object.freeze({
  resources: 'elementalist.evoker.resources',
  foxsFury: 'elementalist.evoker.foxs-fury',
  familiarUtility: 'elementalist.evoker.familiar-utility',
  ignite: 'elementalist.evoker.ignite',
  splash: 'elementalist.evoker.splash',
  zap: 'elementalist.evoker.zap',
  calcify: 'elementalist.evoker.calcify',
  evocation: TRAIT.EVOCATION,
  enhancedPotency: TRAIT.ENHANCED_POTENCY,
  familiarsProwess: TRAIT.FAMILIARS_PROWESS,
  altruisticAspect: TRAIT.ALTRUISTIC_ASPECT,
  familiarsFocus: TRAIT.FAMILIARS_FOCUS,
  familiarsBlessing: TRAIT.FAMILIARS_BLESSING,
  elementalDynamo: TRAIT.ELEMENTAL_DYNAMO,
  galvanicEnchantment: TRAIT.GALVANIC_ENCHANTMENT,
  elementalBalance: TRAIT.ELEMENTAL_BALANCE,
  specializedElements: TRAIT.SPECIALIZED_ELEMENTS,
  specializedElementsBasicRecharge: 'elementalist.evoker.specialized-elements.basic-recharge',
  specializedElementsEmpoweredRecharge: 'elementalist.evoker.specialized-elements.empowered-recharge'
});

// terse constructor for the many named boon effects declared below
const boon = (name: string, boonName: string, stacks: number, duration: number): SkillEffect => ({
  type: 'boon',
  name,
  boon: boonName,
  stacks,
  duration
});

/**
 * The profile set registered with the Elementalist catalog: one mechanic profile
 * for the charge economy, skill-variant profiles for tiered or stateful familiar
 * skills, and one profile per Evoker trait.
 */
export const EVOKER_BALANCE_PROFILES: readonly BalanceProfile[] = Object.freeze([
  {
    id: EVOKER_BALANCE_PROFILE_IDS.resources,
    name: 'Evoker Familiar Charges',
    profileKind: 'mechanic',
    maximumStacks: 6,
    minimumStacks: 3,
    playerStacks: 2,
    allyStacks: 1,
    recharge: 1.5,
    effects: []
  },
  {
    id: EVOKER_BALANCE_PROFILE_IDS.foxsFury,
    parentId: ID.FOXS_FURY,
    name: "Fox's Fury - Might Tiers",
    profileKind: 'skill-variant',
    initialDelay: 0.56,
    threshold: 10,
    effects: [
      { type: 'strike', name: 'Tier 1', coefficient: 1.5, hits: 1 },
      {
        type: 'condition',
        name: 'Tier 1',
        condition: 'Burning',
        stacks: 1,
        duration: 3
      },
      { type: 'strike', name: 'Tier 2', coefficient: 2.25, hits: 1 },
      {
        type: 'condition',
        name: 'Tier 2',
        condition: 'Burning',
        stacks: 2,
        duration: 5
      },
      { type: 'strike', name: 'Tier 3', coefficient: 3, hits: 1 },
      {
        type: 'condition',
        name: 'Tier 3',
        condition: 'Burning',
        stacks: 3,
        duration: 7
      }
    ]
  },
  {
    id: EVOKER_BALANCE_PROFILE_IDS.familiarUtility,
    parentId: ID.HARES_AGILITY,
    name: 'Evoker Familiar Utility Effects',
    profileKind: 'skill-variant',
    playerStacks: 5,
    resourceGain: 1,
    effects: [
      boon('Fox Might', 'might', 8, 10),
      boon('Fox Fire Bonus', 'might', 3, 10),
      boon('Fox Fury', 'fury', 1, 10),
      boon('Toad Resistance', 'resistance', 1, 4),
      {
        type: 'buff',
        name: 'Zap Window',
        kind: 'zap-buff',
        stacks: 1,
        duration: 5
      }
    ]
  },
  variant(EVOKER_BALANCE_PROFILE_IDS.ignite, ID.IGNITE, 'Ignite - Familiar State', {
    initialDelay: 0.96,
    durationMultiplier: 2.4,
    threshold: 15,
    pulseInterval: 1,
    effects: [
      {
        type: 'condition',
        name: 'Tier 1',
        condition: 'Burning',
        stacks: 1,
        duration: 2
      },
      {
        type: 'condition',
        name: 'Tier 2',
        condition: 'Burning',
        stacks: 1,
        duration: 0.5
      },
      {
        type: 'condition',
        name: 'Tier 3',
        condition: 'Burning',
        stacks: 1,
        duration: 1
      },
      {
        type: 'condition',
        name: 'Tier 4',
        condition: 'Burning',
        stacks: 1,
        duration: 1.5
      }
    ]
  }),
  variant(EVOKER_BALANCE_PROFILE_IDS.splash, ID.SPLASH, 'Splash - Familiar State', {
    initialDelay: 0.84,
    durationMultiplier: 2.4
  }),
  variant(EVOKER_BALANCE_PROFILE_IDS.zap, ID.ZAP, 'Zap - Familiar State', {
    initialDelay: 0.68,
    durationMultiplier: 2.3
  }),
  variant(EVOKER_BALANCE_PROFILE_IDS.calcify, ID.CALCIFY, 'Calcify - Familiar State', {
    initialDelay: 0.28,
    durationMultiplier: 2.2
  }),
  trait(EVOKER_BALANCE_PROFILE_IDS.evocation, 'Evocation', {
    internalCooldown: 5,
    effects: [boon('Fire Familiar', 'might', 1, 6)]
  }),
  trait(EVOKER_BALANCE_PROFILE_IDS.enhancedPotency, 'Enhanced Potency', {
    attributeBonus: 75,
    attributePerStack: 5
  }),
  trait(EVOKER_BALANCE_PROFILE_IDS.familiarsProwess, "Familiar's Prowess", {
    durationMultiplier: 5,
    maximumStacks: 15,
    durationPerTier: 5
  }),
  trait(EVOKER_BALANCE_PROFILE_IDS.altruisticAspect, 'Altruistic Aspect', {
    effects: [
      boon("Fox's Fury", 'might', 3, 10),
      boon("Hare's Agility", 'fury', 1, 5),
      boon("Toad's Fortitude", 'stability', 1, 5),
      boon('Elemental Procession', 'resistance', 1, 5)
    ]
  }),
  trait(EVOKER_BALANCE_PROFILE_IDS.familiarsFocus, "Familiar's Focus", {
    damageIncrease: 0.1
  }),
  trait(EVOKER_BALANCE_PROFILE_IDS.familiarsBlessing, "Familiar's Blessing", {
    effects: [boon('Quickness', 'quickness', 1, 1.75), boon('Alacrity', 'alacrity', 1, 4)]
  }),
  trait(EVOKER_BALANCE_PROFILE_IDS.elementalDynamo, 'Elemental Dynamo', {
    resourceGain: 1
  }),
  trait(EVOKER_BALANCE_PROFILE_IDS.galvanicEnchantment, 'Galvanic Enchantment', {
    playerStacks: 2,
    effects: [
      { type: 'strike', coefficient: 0.4, hits: 1 },
      { type: 'condition', condition: 'Burning', stacks: 1, duration: 1.5 }
    ]
  }),
  trait(EVOKER_BALANCE_PROFILE_IDS.elementalBalance, 'Elemental Balance', {
    threshold: 2,
    durationMultiplier: 5,
    rechargeMultiplier: 0.34
  }),
  trait(EVOKER_BALANCE_PROFILE_IDS.specializedElements, 'Specialized Elements', {
    maximumStacks: 6,
    playerStacks: 3
  }),
  variant(
    EVOKER_BALANCE_PROFILE_IDS.specializedElementsBasicRecharge,
    TRAIT.SPECIALIZED_ELEMENTS,
    'Specialized Elements - Basic Familiar Recharge',
    { rechargeMultiplier: 0.9 }
  ),
  variant(
    EVOKER_BALANCE_PROFILE_IDS.specializedElementsEmpoweredRecharge,
    TRAIT.SPECIALIZED_ELEMENTS,
    'Specialized Elements - Empowered Familiar Recharge',
    { rechargeMultiplier: 0.67 }
  )
]);
