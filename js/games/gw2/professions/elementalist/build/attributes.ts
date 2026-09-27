import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import {
  ELEMENTALIST_SKILL_IDS as ID,
  ELEMENTALIST_TRAIT_IDS as TRAIT
} from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/catalog.js';
import { getActiveTraits } from '#gw2/professions/elementalist/data/traits-data.js';
import {
  createBuildAttributeContext,
  finalizeProfessionBuildAttributes
} from '#gw2/professions/shared/build-attributes.js';
import type {
  Gw2AttributeEffect,
  Gw2BuildAttributeRuleContext,
  Gw2CommonAttributeResult,
  Gw2FinalizedAttributeResult,
  Gw2NumericAttributes
} from '#gw2/platform/builds/types.js';

/**
 * The Elementalist's profession-specific half of attribute calculation: it declares the
 * trait and signet effects the shared calculator cannot know about, and returns the
 * finalized attribute set the simulation and the editor's attribute panel both read.
 */
// Fold build-time trait, weapon, and selected-skill bonuses into the common
// attributes while preserving trait-duration and provenance metadata.
export function applyElementalistBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  context: Gw2BuildAttributeRuleContext
): Gw2FinalizedAttributeResult {
  const traitDurations: Gw2NumericAttributes = {};

  const { activeTraits, hasTrait, hasSelectedSkill, profileContext } = createBuildAttributeContext(
    context,
    elementalistCatalog,
    getActiveTraits
  );

  const ferociousWindsProfile = requireBalanceProfileFromContext(profileContext, TRAIT.FEROCIOUS_WINDS);
  const strengthOfStoneProfile = requireBalanceProfileFromContext(profileContext, TRAIT.STRENGTH_OF_STONE);
  const signetOfFirePassiveProfile = requireBalanceProfileFromContext(
    profileContext,
    'elementalist.core.signet-of-fire-passive'
  );
  const burningRageProfile = requireBalanceProfileFromContext(profileContext, TRAIT.BURNING_RAGE);
  const aeromancersTrainingProfile = requireBalanceProfileFromContext(profileContext, TRAIT.AEROMANCERS_TRAINING);
  const elementalEnchantmentProfile = requireBalanceProfileFromContext(profileContext, TRAIT.ELEMENTAL_ENCHANTMENT);
  const gatheredFocusProfile = requireBalanceProfileFromContext(profileContext, TRAIT.GATHERED_FOCUS);
  const soothingPowerProfile = requireBalanceProfileFromContext(profileContext, TRAIT.SOOTHING_POWER);
  const elementalRefreshmentProfile = requireBalanceProfileFromContext(profileContext, TRAIT.ELEMENTAL_REFRESHMENT);
  // Every effect here is declarative: the shared resolver applies flat grants first, then
  // conversions. `input: 'common'` converts from the pre-effect totals and
  // `feedsConversions: false` keeps a flat grant out of any conversion's input.
  const attributeEffects: readonly Gw2AttributeEffect[] = [
    {
      kind: 'conversion',
      source: 'Ferocious Winds',
      from: 'Precision',
      to: 'Ferocity',
      multiplier: balanceProfileNumber(ferociousWindsProfile, 'attributeConversion'),
      rounding: 'round',
      input: 'common',
      enabled: hasTrait(TRAIT.FEROCIOUS_WINDS)
    },
    {
      kind: 'conversion',
      source: 'Strength of Stone',
      from: 'Toughness',
      to: 'Condition Damage',
      multiplier: balanceProfileNumber(strengthOfStoneProfile, 'attributeConversion'),
      rounding: 'round',
      input: 'common',
      enabled: hasTrait(TRAIT.STRENGTH_OF_STONE)
    },
    {
      kind: 'flat',
      source: 'Signet of Fire',
      to: 'Precision',
      amount: balanceProfileNumber(signetOfFirePassiveProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasSelectedSkill(ID.SIGNET_OF_FIRE)
    },
    {
      kind: 'flat',
      source: 'Burning Rage',
      to: 'Condition Damage',
      amount: balanceProfileNumber(burningRageProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait(TRAIT.BURNING_RAGE)
    },
    {
      kind: 'flat',
      source: "Aeromancer's Training",
      to: 'Ferocity',
      amount: balanceProfileNumber(aeromancersTrainingProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait(TRAIT.AEROMANCERS_TRAINING)
    },
    {
      kind: 'flat',
      source: 'Elemental Enchantment',
      to: 'Concentration',
      amount: balanceProfileNumber(elementalEnchantmentProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait(TRAIT.ELEMENTAL_ENCHANTMENT)
    },
    {
      kind: 'flat',
      source: 'Gathered Focus',
      to: 'Concentration',
      amount: balanceProfileNumber(gatheredFocusProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait(TRAIT.GATHERED_FOCUS)
    },
    {
      kind: 'flat',
      source: 'Soothing Power',
      to: 'Vitality',
      amount: balanceProfileNumber(soothingPowerProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait(TRAIT.SOOTHING_POWER)
    },
    {
      kind: 'flat',
      source: 'Elemental Refreshment',
      to: 'Vitality',
      amount: balanceProfileNumber(elementalRefreshmentProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait(TRAIT.ELEMENTAL_REFRESHMENT)
    }
  ];

  // Condition-duration traits are percentage bonuses, tracked apart from the flat effects.
  if (hasTrait(TRAIT.BURNING_PRECISION)) {
    const burningPrecisionProfile = requireBalanceProfileFromContext(profileContext, TRAIT.BURNING_PRECISION);
    traitDurations['Burning Duration'] = balanceProfileNumber(burningPrecisionProfile, 'durationMultiplier');
  }

  if (hasTrait(TRAIT.SERRATED_STONES)) {
    const serratedStonesProfile = requireBalanceProfileFromContext(profileContext, TRAIT.SERRATED_STONES);
    traitDurations['Bleeding Duration'] = balanceProfileNumber(serratedStonesProfile, 'durationMultiplier');
  }

  return finalizeProfessionBuildAttributes(common, {
    activeTraits,
    attributeEffects,
    traitDurations,
    traitCriticalChance: hasTrait(TRAIT.ZEPHYRS_SPEED)
      ? 100 *
        balanceProfileNumber(requireBalanceProfileFromContext(profileContext, TRAIT.ZEPHYRS_SPEED), 'criticalChance')
      : 0
  });
}
