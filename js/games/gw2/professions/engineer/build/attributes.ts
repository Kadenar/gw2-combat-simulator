import { engineerCatalog } from '#gw2/professions/engineer/catalog.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { getActiveTraits } from '#gw2/professions/engineer/data/traits-data.js';
import {
  createBuildAttributeContext,
  finalizeProfessionBuildAttributes
} from '#gw2/professions/shared/build-attributes.js';
import type {
  Gw2BuildAttributeRuleContext,
  Gw2AttributeEffect,
  Gw2CommonAttributeResult,
  Gw2NumericAttributes
} from '#gw2/platform/builds/types.js';
import type { EngineerBuild, EngineerFinalizedAttributeResult } from '#gw2/professions/engineer/types.js';

/** Applies Engineer trait bonuses and exposes the pre-profession conversion pool used by Amalgam. */
export function applyEngineerBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  { build, disabledTrait = null, balanceContext }: Gw2BuildAttributeRuleContext
): EngineerFinalizedAttributeResult {
  const engineerBuild = build as EngineerBuild;
  const { conversionPool: commonConversionPool } = common.commonContext;

  const { activeTraits, hasTrait } = createBuildAttributeContext({
    specializations: engineerBuild.specializations || [],
    disabledTrait,
    getActiveTraits
  });

  // Build previews and simulation tooltips use the same selected patch values.
  const profileContext = balanceContext ?? { catalog: engineerCatalog };

  const traitDurations: Gw2NumericAttributes = {};

  const chemicalRoundsProfile = requireBalanceProfileFromContext(profileContext, TRAIT.CHEMICAL_ROUNDS);
  const thermalVisionProfile = requireBalanceProfileFromContext(profileContext, TRAIT.THERMAL_VISION);
  const compoundingChemicalsProfile = requireBalanceProfileFromContext(profileContext, TRAIT.COMPOUNDING_CHEMICALS);
  const hybridVigorProfile = requireBalanceProfileFromContext(profileContext, TRAIT.HYBRID_VIGOR);
  const blastShieldProfile = requireBalanceProfileFromContext(profileContext, TRAIT.BLAST_SHIELD);
  const energyAmplifierProfile = requireBalanceProfileFromContext(profileContext, TRAIT.ENERGY_AMPLIFIER);
  const noScopeProfile = requireBalanceProfileFromContext(profileContext, TRAIT.NO_SCOPE);
  const kineticAcceleratorsProfile = requireBalanceProfileFromContext(profileContext, TRAIT.KINETIC_ACCELERATORS);
  // Describe static trait bonuses declaratively so shared provenance and conversion ordering stay intact.
  const attributeEffects: readonly Gw2AttributeEffect[] = [
    {
      kind: 'flat',
      source: 'Chemical Rounds',
      to: 'Condition Damage',
      amount: balanceProfileNumber(chemicalRoundsProfile, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait('Chemical Rounds')
    },
    {
      kind: 'flat',
      source: 'Thermal Vision',
      to: 'Expertise',
      amount: balanceProfileNumber(thermalVisionProfile, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait('Thermal Vision')
    },
    {
      kind: 'flat',
      source: 'Compounding Chemicals',
      to: 'Concentration',
      amount: balanceProfileNumber(compoundingChemicalsProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('Compounding Chemicals')
    },
    {
      kind: 'flat',
      source: 'Hybrid Vigor',
      to: 'Vitality',
      amount: balanceProfileNumber(hybridVigorProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('Hybrid Vigor')
    },
    {
      kind: 'conversion',
      source: 'Blast Shield',
      from: 'Power',
      to: 'Vitality',
      multiplier: balanceProfileNumber(blastShieldProfile, 'attributeConversion'),
      rounding: 'none',
      input: 'eligible',
      enabled: hasTrait('Blast Shield')
    },
    {
      kind: 'flat',
      source: 'Energy Amplifier',
      to: 'Power',
      amount: balanceProfileNumber(energyAmplifierProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('Energy Amplifier') && engineerBuild.assumptions?.regeneration !== false
    },
    {
      kind: 'flat',
      source: 'Energy Amplifier',
      to: 'Healing Power',
      amount: balanceProfileNumber(energyAmplifierProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('Energy Amplifier') && engineerBuild.assumptions?.regeneration !== false
    },
    {
      kind: 'flat',
      source: 'No Scope',
      to: 'Ferocity',
      amount: balanceProfileNumber(noScopeProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('No Scope') && engineerBuild.assumptions?.fury !== false
    },
    {
      kind: 'conversion',
      source: 'Kinetic Accelerators',
      from: 'Power',
      to: 'Concentration',
      multiplier: balanceProfileNumber(kineticAcceleratorsProfile, 'attributeConversion'),
      rounding: 'round',
      input: 'eligible',
      enabled: hasTrait('Kinetic Accelerators')
    }
  ];

  // Surface static condition-duration traits in the panel so the same finalized values can seed simulation stats.
  if (hasTrait('Serrated Steel')) {
    const serratedSteelProfile = requireBalanceProfileFromContext(profileContext, TRAIT.SERRATED_STEEL);
    traitDurations['Bleeding Duration'] = 100 * balanceProfileNumber(serratedSteelProfile, 'durationMultiplier');
  }

  if (hasTrait('Incendiary Powder')) {
    const incendiaryPowderProfile = requireBalanceProfileFromContext(profileContext, TRAIT.INCENDIARY_POWDER);
    traitDurations['Burning Duration'] = 100 * balanceProfileNumber(incendiaryPowderProfile, 'durationMultiplier');
  }

  if (hasTrait('Carbolic Composition')) {
    const carbolicCompositionProfile = requireBalanceProfileFromContext(profileContext, TRAIT.CARBOLIC_COMPOSITION);
    traitDurations['Poison Duration'] =
      100 * balanceProfileNumber(carbolicCompositionProfile, 'conditionDurationBonus');
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
