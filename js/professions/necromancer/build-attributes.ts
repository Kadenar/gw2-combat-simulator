import { getActiveTraits } from './data/traits-data.js';
import { createBuildAttributeContext, finalizeProfessionBuildAttributes } from '../lib/build-attributes.js';
import type {
  Gw2BuildAttributeRuleContext,
  Gw2AttributeEffect,
  Gw2CommonAttributeResult,
  Gw2FinalizedAttributeResult,
  Gw2NumericAttributes
} from '../../platform/gw2/builds/types.js';
import type { NecromancerSpecializationSelection } from './data/traits-data.js';

// Apply Necromancer flat bonuses and ordered attribute conversions at build time,
// then add trait-specific duration and critical-chance contributions.
export function applyNecromancerBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  { build, selectedSkills = [], disabledTrait = null }: Gw2BuildAttributeRuleContext
): Gw2FinalizedAttributeResult {
  const { activeTraits, hasTrait, hasSelectedSkill } = createBuildAttributeContext({
    specializations: (build.specializations || []) as NecromancerSpecializationSelection[],
    selectedSkills,
    disabledTrait,
    getActiveTraits
  });

  const traitDurations: Gw2NumericAttributes = {};

  const attributeEffects: readonly Gw2AttributeEffect[] = [
    {
      kind: 'conversion',
      source: 'Spiteful Fortitude',
      from: 'Power',
      to: 'Vitality',
      multiplier: 0.1,
      rounding: 'none',
      input: 'common',
      enabled: hasTrait('Spiteful Fortitude')
    },
    {
      kind: 'flat',
      source: 'Furious Demise',
      to: 'Precision',
      amount: 180,
      feedsConversions: true,
      enabled: hasTrait('Furious Demise')
    },
    {
      kind: 'flat',
      source: 'Lingering Curse',
      to: 'Condition Damage',
      amount: 200,
      feedsConversions: false,
      enabled: hasTrait('Lingering Curse')
    },
    {
      kind: 'flat',
      source: 'Vital Persistence',
      to: 'Vitality',
      amount: 180,
      feedsConversions: true,
      enabled: hasTrait('Vital Persistence')
    },
    {
      kind: 'flat',
      source: 'Alchemic Vigor',
      to: 'Vitality',
      amount: 240,
      feedsConversions: true,
      enabled: hasTrait('Alchemic Vigor')
    },
    {
      kind: 'conversion',
      source: 'Implacable Foe',
      from: 'Vitality',
      to: 'Ferocity',
      multiplier: 0.13,
      rounding: 'none',
      input: 'eligible',
      enabled: hasTrait('Implacable Foe')
    },
    {
      kind: 'conversion',
      source: 'Twisted Medicine',
      from: 'Vitality',
      to: 'Concentration',
      multiplier: 0.13,
      rounding: 'none',
      input: 'eligible',
      enabled: hasTrait('Twisted Medicine')
    },
    {
      kind: 'conversion',
      source: 'Dark Gunslinger',
      from: 'Vitality',
      to: 'Expertise',
      multiplier: 0.1,
      rounding: 'round',
      input: 'eligible',
      enabled: hasTrait('Dark Gunslinger')
    },
    {
      kind: 'flat',
      source: 'Boon of Creation',
      to: 'Concentration',
      amount: 180,
      feedsConversions: false,
      enabled: hasTrait('Boon of Creation')
    },
    {
      kind: 'conversion',
      source: 'Target the Weak',
      from: 'Precision',
      to: 'Condition Damage',
      multiplier: 0.13,
      rounding: 'floor',
      input: 'eligible',
      enabled: hasTrait('Target the Weak')
    },
    {
      kind: 'conversion',
      source: 'Fell Beacon',
      from: 'Condition Damage',
      to: 'Expertise',
      multiplier: 0.07,
      rounding: 'none',
      input: 'eligible',
      enabled: hasTrait('Fell Beacon')
    },
    {
      kind: 'flat',
      source: 'Signet of Spite',
      to: 'Power',
      amount: 180,
      feedsConversions: false,
      enabled: hasSelectedSkill('Signet of Spite')
    }
  ];

  if (hasTrait('Barbed Precision')) {
    traitDurations['Bleeding Duration'] = 20;
  }

  return finalizeProfessionBuildAttributes(common, {
    activeTraits,
    attributeEffects,
    traitDurations,
    traitCriticalChance: hasTrait('Death Perception') ? 15 : 0
  });
}
