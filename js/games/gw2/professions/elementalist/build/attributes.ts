import { balanceProfileNumberFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
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

import type { ElementalistBuildSpecialization } from '#gw2/professions/elementalist/build/types.js';

/**
 * The Elementalist's profession-specific half of attribute calculation: it declares the
 * trait and signet effects the shared calculator cannot know about, and returns the
 * finalized attribute set the simulation and the editor's attribute panel both read.
 */
// Fold build-time trait, weapon, and selected-skill bonuses into the common
// attributes while preserving trait-duration and provenance metadata.
export function applyElementalistBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  { build, selectedSkills = [], disabledTrait = null, balanceContext }: Gw2BuildAttributeRuleContext
): Gw2FinalizedAttributeResult {
  // Attribute amounts follow the selected patch while effect ordering and eligibility remain unchanged.
  const profileContext = balanceContext ?? { catalog: elementalistCatalog };
  const traitDurations: Gw2NumericAttributes = {};

  const { activeTraits, hasTrait, hasSelectedSkill } = createBuildAttributeContext({
    specializations: (build.specializations || []) as ElementalistBuildSpecialization[],
    selectedSkills,
    disabledTrait,
    getActiveTraits
  });

  // Every effect here is declarative: the shared resolver applies flat grants first, then
  // conversions. `input: 'common'` converts from the pre-effect totals and
  // `feedsConversions: false` keeps a flat grant out of any conversion's input.
  const attributeEffects: readonly Gw2AttributeEffect[] = [
    {
      kind: 'conversion',
      source: 'Ferocious Winds',
      from: 'Precision',
      to: 'Ferocity',
      multiplier: balanceProfileNumberFromContext(profileContext, TRAIT.FEROCIOUS_WINDS, 'attributeConversion'),
      rounding: 'round',
      input: 'common',
      enabled: hasTrait('Ferocious Winds')
    },
    {
      kind: 'conversion',
      source: 'Strength of Stone',
      from: 'Toughness',
      to: 'Condition Damage',
      multiplier: balanceProfileNumberFromContext(profileContext, TRAIT.STRENGTH_OF_STONE, 'attributeConversion'),
      rounding: 'round',
      input: 'common',
      enabled: hasTrait('Strength of Stone')
    },
    {
      kind: 'flat',
      source: 'Signet of Fire',
      to: 'Precision',
      amount: balanceProfileNumberFromContext(
        profileContext,
        'elementalist.core.signet-of-fire-passive',
        'attributeBonus'
      ),
      feedsConversions: false,
      enabled: hasSelectedSkill('Signet of Fire')
    },
    {
      kind: 'flat',
      source: 'Burning Rage',
      to: 'Condition Damage',
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.BURNING_RAGE, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('Burning Rage')
    },
    {
      kind: 'flat',
      source: "Aeromancer's Training",
      to: 'Ferocity',
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.AEROMANCERS_TRAINING, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait("Aeromancer's Training")
    },
    {
      kind: 'flat',
      source: 'Elemental Enchantment',
      to: 'Concentration',
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.ELEMENTAL_ENCHANTMENT, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('Elemental Enchantment')
    },
    {
      kind: 'flat',
      source: 'Gathered Focus',
      to: 'Concentration',
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.GATHERED_FOCUS, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('Gathered Focus')
    },
    {
      kind: 'flat',
      source: 'Soothing Power',
      to: 'Vitality',
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.SOOTHING_POWER, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('Soothing Power')
    },
    {
      kind: 'flat',
      source: 'Elemental Refreshment',
      to: 'Vitality',
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.ELEMENTAL_REFRESHMENT, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('Elemental Refreshment')
    }
  ];

  // Condition-duration traits are percentage bonuses, tracked apart from the flat effects.
  if (hasTrait('Burning Precision')) {
    traitDurations['Burning Duration'] = balanceProfileNumberFromContext(
      profileContext,
      TRAIT.BURNING_PRECISION,
      'durationMultiplier'
    );
  }

  if (hasTrait('Serrated Stones')) {
    traitDurations['Bleeding Duration'] = balanceProfileNumberFromContext(
      profileContext,
      TRAIT.SERRATED_STONES,
      'durationMultiplier'
    );
  }

  return finalizeProfessionBuildAttributes(common, {
    activeTraits,
    attributeEffects,
    traitDurations,
    traitCriticalChance: hasTrait("Zephyr's Speed")
      ? 100 * balanceProfileNumberFromContext(profileContext, TRAIT.ZEPHYRS_SPEED, 'criticalChance')
      : 0
  });
}
