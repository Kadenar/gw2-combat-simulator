import { getActiveTraits } from '#gw2/professions/engineer/data/traits-data.js';
import {
  createBuildAttributeContext,
  finalizeProfessionBuildAttributes
} from '#gw2/professions/lib/build-attributes.js';
import type {
  Gw2BuildAttributeRuleContext,
  Gw2AttributeEffect,
  Gw2CommonAttributeResult,
  Gw2FinalizedAttributeResult,
  Gw2NumericAttributes
} from '#gw2/platform/builds/types.js';
import type { EngineerBuild } from '#gw2/professions/engineer/types.js';

/** Applies Engineer trait bonuses and exposes the pre-profession conversion pool used by Amalgam. */
export function applyEngineerBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  { build, disabledTrait = null }: Gw2BuildAttributeRuleContext
): Gw2FinalizedAttributeResult {
  const engineerBuild = build as EngineerBuild;
  const { conversionPool: commonConversionPool } = common.commonContext;

  const { activeTraits, hasTrait } = createBuildAttributeContext({
    specializations: engineerBuild.specializations || [],
    disabledTrait,
    getActiveTraits
  });

  const traitDurations: Gw2NumericAttributes = {};

  // Describe static trait bonuses declaratively so shared provenance and conversion ordering stay intact.
  const attributeEffects: readonly Gw2AttributeEffect[] = [
    {
      kind: 'flat',
      source: 'Chemical Rounds',
      to: 'Condition Damage',
      amount: 120,
      feedsConversions: true,
      enabled: hasTrait('Chemical Rounds')
    },
    {
      kind: 'flat',
      source: 'Thermal Vision',
      to: 'Expertise',
      amount: 150,
      feedsConversions: true,
      enabled: hasTrait('Thermal Vision')
    },
    {
      kind: 'flat',
      source: 'Compounding Chemicals',
      to: 'Concentration',
      amount: 240,
      feedsConversions: false,
      enabled: hasTrait('Compounding Chemicals')
    },
    {
      kind: 'flat',
      source: 'Hybrid Vigor',
      to: 'Vitality',
      amount: 240,
      feedsConversions: false,
      enabled: hasTrait('Hybrid Vigor')
    },
    {
      kind: 'conversion',
      source: 'Blast Shield',
      from: 'Power',
      to: 'Vitality',
      multiplier: 0.1,
      rounding: 'none',
      input: 'eligible',
      enabled: hasTrait('Blast Shield')
    },
    {
      kind: 'flat',
      source: 'Energy Amplifier',
      to: 'Power',
      amount: 250,
      feedsConversions: false,
      enabled: hasTrait('Energy Amplifier') && engineerBuild.assumptions?.regeneration !== false
    },
    {
      kind: 'flat',
      source: 'Energy Amplifier',
      to: 'Healing Power',
      amount: 250,
      feedsConversions: false,
      enabled: hasTrait('Energy Amplifier') && engineerBuild.assumptions?.regeneration !== false
    },
    {
      kind: 'flat',
      source: 'No Scope',
      to: 'Ferocity',
      amount: 150,
      feedsConversions: false,
      enabled: hasTrait('No Scope') && engineerBuild.assumptions?.fury !== false
    },
    {
      kind: 'conversion',
      source: 'Kinetic Accelerators',
      from: 'Power',
      to: 'Concentration',
      multiplier: 0.13,
      rounding: 'round',
      input: 'eligible',
      enabled: hasTrait('Kinetic Accelerators')
    }
  ];

  // Surface static condition-duration traits in the panel so the same finalized values can seed simulation stats.
  if (hasTrait('Serrated Steel')) {
    traitDurations['Bleeding Duration'] = 33;
  }

  if (hasTrait('Incendiary Powder')) {
    traitDurations['Burning Duration'] = 33;
  }

  if (hasTrait('Carbolic Composition')) {
    traitDurations['Poison Duration'] = 33;
  }

  // Preserve the common conversion pool separately because Amalgam evolves from the pre-profession values.
  const finalized = finalizeProfessionBuildAttributes(common, {
    activeTraits,
    attributeEffects,
    traitDurations
  });

  return {
    ...finalized,
    amalgamEvolveAttributePool: {
      ...commonConversionPool
    }
  };
}
