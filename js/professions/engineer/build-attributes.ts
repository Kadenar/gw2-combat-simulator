import { finalizeBuildAttributes, resolveAttributeEffects } from '../../platform/gw2/attributes.js';
import { getActiveTraits } from './data/traits-data.js';
import type {
  Gw2BuildAttributeRuleContext,
  Gw2AttributeEffect,
  Gw2CommonAttributeResult,
  Gw2FinalizedAttributeResult,
  Gw2NumericAttributes
} from '../../platform/gw2/types.js';
import type { EngineerBuild } from './types.js';

export function applyEngineerBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  { build, disabledTrait = null }: Gw2BuildAttributeRuleContext
): Gw2FinalizedAttributeResult {
  const engineerBuild = build as EngineerBuild;
  const { conversionPool: commonConversionPool } = common.commonContext;
  const activeTraits = getActiveTraits(engineerBuild.specializations || []).filter(
    (trait) => trait.name !== disabledTrait
  );
  const hasTrait = (name: string): boolean => activeTraits.some((trait) => trait.name === name);
  const traitDurations: Gw2NumericAttributes = {};
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
      // Keep this outside conversions until its in-game behavior is confirmed.
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
  const traitStats = resolveAttributeEffects(commonConversionPool, attributeEffects);

  const finalized = finalizeBuildAttributes(common, {
    activeTraits,
    traitStats,
    traitDurations
  });
  // Preserve the common conversion pool for runtime percentage-stat effects;
  // it already excludes temporary trait bonuses and other ineligible sources.
  return {
    ...finalized,
    amalgamEvolveAttributePool: { ...commonConversionPool }
  };
}
