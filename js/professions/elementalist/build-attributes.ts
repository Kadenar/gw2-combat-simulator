import { getActiveTraits } from './data/traits-data.js';
import { createBuildAttributeContext, finalizeProfessionBuildAttributes } from '../lib/build-attributes.js';
import type {
  Gw2AttributeEffect,
  Gw2BuildAttributeRuleContext,
  Gw2CommonAttributeResult,
  Gw2FinalizedAttributeResult,
  Gw2NumericAttributes
} from '../../platform/gw2/builds/types.js';
import type { ElementalistBuildSpecialization } from './types.js';

// Fold build-time trait, weapon, and selected-skill bonuses into the common
// attributes while preserving trait-duration and provenance metadata.
export function applyElementalistBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  { build, selectedSkills = [], disabledTrait = null }: Gw2BuildAttributeRuleContext
): Gw2FinalizedAttributeResult {
  const traitDurations: Gw2NumericAttributes = {};

  const { activeTraits, hasTrait, hasSelectedSkill } = createBuildAttributeContext({
    specializations: (build.specializations || []) as ElementalistBuildSpecialization[],
    selectedSkills,
    disabledTrait,
    getActiveTraits
  });

  const attributeEffects: readonly Gw2AttributeEffect[] = [
    {
      kind: 'conversion',
      source: 'Ferocious Winds',
      from: 'Precision',
      to: 'Ferocity',
      multiplier: 0.07,
      rounding: 'round',
      input: 'common',
      enabled: hasTrait('Ferocious Winds')
    },
    {
      kind: 'conversion',
      source: 'Strength of Stone',
      from: 'Toughness',
      to: 'Condition Damage',
      multiplier: 0.1,
      rounding: 'round',
      input: 'common',
      enabled: hasTrait('Strength of Stone')
    },
    {
      kind: 'flat',
      source: 'Signet of Fire',
      to: 'Precision',
      amount: 180,
      feedsConversions: false,
      enabled: hasSelectedSkill('Signet of Fire')
    },
    {
      kind: 'flat',
      source: 'Burning Rage',
      to: 'Condition Damage',
      amount: 180,
      feedsConversions: false,
      enabled: hasTrait('Burning Rage')
    },
    {
      kind: 'flat',
      source: "Aeromancer's Training",
      to: 'Ferocity',
      amount: 150,
      feedsConversions: false,
      enabled: hasTrait("Aeromancer's Training")
    },
    {
      kind: 'flat',
      source: 'Elemental Enchantment',
      to: 'Concentration',
      amount: 180,
      feedsConversions: false,
      enabled: hasTrait('Elemental Enchantment')
    },
    {
      kind: 'flat',
      source: 'Gathered Focus',
      to: 'Concentration',
      amount: 240,
      feedsConversions: false,
      enabled: hasTrait('Gathered Focus')
    },
    {
      kind: 'flat',
      source: 'Soothing Power',
      to: 'Vitality',
      amount: 300,
      feedsConversions: false,
      enabled: hasTrait('Soothing Power')
    },
    {
      kind: 'flat',
      source: 'Elemental Refreshment',
      to: 'Vitality',
      amount: 180,
      feedsConversions: false,
      enabled: hasTrait('Elemental Refreshment')
    }
  ];

  if (hasTrait('Burning Precision')) {
    traitDurations['Burning Duration'] = 20;
  }

  if (hasTrait('Serrated Stones')) {
    traitDurations['Bleeding Duration'] = 20;
  }

  return finalizeProfessionBuildAttributes(common, {
    activeTraits,
    attributeEffects,
    traitDurations,
    traitCriticalChance: hasTrait("Zephyr's Speed") ? 5 : 0
  });
}
