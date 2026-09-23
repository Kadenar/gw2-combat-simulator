import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { necromancerCatalog } from '#gw2/professions/necromancer/catalog.js';
import { getActiveTraits } from '#gw2/professions/necromancer/data/traits-data.js';

import {
  createBuildAttributeContext,
  finalizeProfessionBuildAttributes
} from '#gw2/professions/shared/build-attributes.js';
import type {
  Gw2BuildAttributeRuleContext,
  Gw2AttributeEffect,
  Gw2CommonAttributeResult,
  Gw2FinalizedAttributeResult,
  Gw2NumericAttributes
} from '#gw2/platform/builds/types.js';
import type { ProfessionTraitSelection } from '#gw2/professions/shared/trait-data.js';

/** Applies Necromancer flat bonuses, ordered conversions, durations, and critical chance at build time. */
export function applyNecromancerBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  { build, selectedSkills = [], disabledTrait = null, balanceContext }: Gw2BuildAttributeRuleContext
): Gw2FinalizedAttributeResult {
  const { activeTraits, hasTrait, hasSelectedSkill } = createBuildAttributeContext({
    specializations: (build.specializations || []) as ProfessionTraitSelection[],
    selectedSkills,
    disabledTrait,
    getActiveTraits
  });

  // Attribute amounts follow the selected patch while effect ordering and eligibility remain unchanged.
  const profileContext = balanceContext ?? { catalog: necromancerCatalog };
  const traitDurations: Gw2NumericAttributes = {};

  const spitefulFortitudeProfile = requireBalanceProfileFromContext(profileContext, TRAIT.SPITEFUL_FORTITUDE);
  const furiousDemiseProfile = requireBalanceProfileFromContext(profileContext, TRAIT.FURIOUS_DEMISE);
  const lingeringCurseProfile = requireBalanceProfileFromContext(profileContext, TRAIT.LINGERING_CURSE);
  const vitalPersistenceProfile = requireBalanceProfileFromContext(profileContext, TRAIT.VITAL_PERSISTENCE);
  const alchemicVigorProfile = requireBalanceProfileFromContext(profileContext, TRAIT.ALCHEMIC_VIGOR);
  const implacableFoeProfile = requireBalanceProfileFromContext(profileContext, TRAIT.IMPLACABLE_FOE);
  const twistedMedicineProfile = requireBalanceProfileFromContext(profileContext, TRAIT.TWISTED_MEDICINE);
  const darkGunslingerProfile = requireBalanceProfileFromContext(profileContext, TRAIT.DARK_GUNSLINGER);
  const boonOfCreationProfile = requireBalanceProfileFromContext(profileContext, TRAIT.BOON_OF_CREATION);
  const targetTheWeakProfile = requireBalanceProfileFromContext(profileContext, TRAIT.TARGET_THE_WEAK);
  const fellBeaconProfile = requireBalanceProfileFromContext(profileContext, TRAIT.FELL_BEACON);
  const signetOfSpitePassiveProfile = requireBalanceProfileFromContext(
    profileContext,
    'necromancer.core.signet-of-spite-passive'
  );
  const attributeEffects: readonly Gw2AttributeEffect[] = [
    {
      kind: 'conversion',
      source: 'Spiteful Fortitude',
      from: 'Power',
      to: 'Vitality',
      multiplier: balanceProfileNumber(spitefulFortitudeProfile, 'attributeConversion'),
      rounding: 'none',
      input: 'common',
      enabled: hasTrait('Spiteful Fortitude')
    },
    {
      kind: 'flat',
      source: 'Furious Demise',
      to: 'Precision',
      amount: balanceProfileNumber(furiousDemiseProfile, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait('Furious Demise')
    },
    {
      kind: 'flat',
      source: 'Lingering Curse',
      to: 'Condition Damage',
      amount: balanceProfileNumber(lingeringCurseProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('Lingering Curse')
    },
    {
      kind: 'flat',
      source: 'Vital Persistence',
      to: 'Vitality',
      amount: balanceProfileNumber(vitalPersistenceProfile, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait('Vital Persistence')
    },
    {
      kind: 'flat',
      source: 'Alchemic Vigor',
      to: 'Vitality',
      amount: balanceProfileNumber(alchemicVigorProfile, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait('Alchemic Vigor')
    },
    {
      kind: 'conversion',
      source: 'Implacable Foe',
      from: 'Vitality',
      to: 'Ferocity',
      multiplier: balanceProfileNumber(implacableFoeProfile, 'attributeConversion'),
      rounding: 'none',
      input: 'eligible',
      enabled: hasTrait('Implacable Foe')
    },
    {
      kind: 'conversion',
      source: 'Twisted Medicine',
      from: 'Vitality',
      to: 'Concentration',
      multiplier: balanceProfileNumber(twistedMedicineProfile, 'attributeConversion'),
      rounding: 'none',
      input: 'eligible',
      enabled: hasTrait('Twisted Medicine')
    },
    {
      kind: 'conversion',
      source: 'Dark Gunslinger',
      from: 'Vitality',
      to: 'Expertise',
      multiplier: balanceProfileNumber(darkGunslingerProfile, 'attributeConversion'),
      rounding: 'round',
      input: 'eligible',
      enabled: hasTrait('Dark Gunslinger')
    },
    {
      kind: 'flat',
      source: 'Boon of Creation',
      to: 'Concentration',
      amount: balanceProfileNumber(boonOfCreationProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait('Boon of Creation')
    },
    {
      kind: 'conversion',
      source: 'Target the Weak',
      from: 'Precision',
      to: 'Condition Damage',
      multiplier: balanceProfileNumber(targetTheWeakProfile, 'attributeConversion'),
      rounding: 'floor',
      input: 'eligible',
      enabled: hasTrait('Target the Weak')
    },
    {
      kind: 'conversion',
      source: 'Fell Beacon',
      from: 'Condition Damage',
      to: 'Expertise',
      multiplier: balanceProfileNumber(fellBeaconProfile, 'attributeConversion'),
      rounding: 'none',
      input: 'eligible',
      enabled: hasTrait('Fell Beacon')
    },
    {
      kind: 'flat',
      source: 'Signet of Spite',
      to: 'Power',
      amount: balanceProfileNumber(signetOfSpitePassiveProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasSelectedSkill('Signet of Spite')
    }
  ];

  if (hasTrait('Barbed Precision')) {
    const barbedPrecisionProfile = requireBalanceProfileFromContext(profileContext, TRAIT.BARBED_PRECISION);
    traitDurations['Bleeding Duration'] =
      balanceProfileNumber(barbedPrecisionProfile, 'conditionDurationMultiplier') * 100 - 100;
  }

  // Finalization merges profession effects with the common equipment-derived attribute result.
  return finalizeProfessionBuildAttributes(common, {
    activeTraits,
    attributeEffects,
    traitDurations,
    traitCriticalChance: hasTrait('Death Perception')
      ? balanceProfileNumber(
          requireBalanceProfileFromContext(profileContext, TRAIT.DEATH_PERCEPTION),
          'criticalChance'
        ) * 100
      : 0
  });
}
