import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
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

/** Applies Necromancer flat bonuses, ordered conversions, durations, and critical chance at build time. */
export function applyNecromancerBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  context: Gw2BuildAttributeRuleContext
): Gw2FinalizedAttributeResult {
  const { activeTraits, hasTrait, hasSelectedSkill, profileContext } = createBuildAttributeContext(
    context,
    necromancerCatalog,
    getActiveTraits
  );

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
      enabled: hasTrait(TRAIT.SPITEFUL_FORTITUDE)
    },
    {
      kind: 'flat',
      source: 'Furious Demise',
      to: 'Precision',
      amount: balanceProfileNumber(furiousDemiseProfile, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait(TRAIT.FURIOUS_DEMISE)
    },
    {
      kind: 'flat',
      source: 'Lingering Curse',
      to: 'Condition Damage',
      amount: balanceProfileNumber(lingeringCurseProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait(TRAIT.LINGERING_CURSE)
    },
    {
      kind: 'flat',
      source: 'Vital Persistence',
      to: 'Vitality',
      amount: balanceProfileNumber(vitalPersistenceProfile, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait(TRAIT.VITAL_PERSISTENCE)
    },
    {
      kind: 'flat',
      source: 'Alchemic Vigor',
      to: 'Vitality',
      amount: balanceProfileNumber(alchemicVigorProfile, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait(TRAIT.ALCHEMIC_VIGOR)
    },
    {
      kind: 'conversion',
      source: 'Implacable Foe',
      from: 'Vitality',
      to: 'Ferocity',
      multiplier: balanceProfileNumber(implacableFoeProfile, 'attributeConversion'),
      rounding: 'none',
      input: 'eligible',
      enabled: hasTrait(TRAIT.IMPLACABLE_FOE)
    },
    {
      kind: 'conversion',
      source: 'Twisted Medicine',
      from: 'Vitality',
      to: 'Concentration',
      multiplier: balanceProfileNumber(twistedMedicineProfile, 'attributeConversion'),
      rounding: 'none',
      input: 'eligible',
      enabled: hasTrait(TRAIT.TWISTED_MEDICINE)
    },
    {
      kind: 'conversion',
      source: 'Dark Gunslinger',
      from: 'Vitality',
      to: 'Expertise',
      multiplier: balanceProfileNumber(darkGunslingerProfile, 'attributeConversion'),
      rounding: 'round',
      input: 'eligible',
      enabled: hasTrait(TRAIT.DARK_GUNSLINGER)
    },
    {
      kind: 'flat',
      source: 'Boon of Creation',
      to: 'Concentration',
      amount: balanceProfileNumber(boonOfCreationProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait(TRAIT.BOON_OF_CREATION)
    },
    {
      kind: 'conversion',
      source: 'Target the Weak',
      from: 'Precision',
      to: 'Condition Damage',
      multiplier: balanceProfileNumber(targetTheWeakProfile, 'attributeConversion'),
      rounding: 'floor',
      input: 'eligible',
      enabled: hasTrait(TRAIT.TARGET_THE_WEAK)
    },
    {
      kind: 'conversion',
      source: 'Fell Beacon',
      from: 'Condition Damage',
      to: 'Expertise',
      multiplier: balanceProfileNumber(fellBeaconProfile, 'attributeConversion'),
      rounding: 'none',
      input: 'eligible',
      enabled: hasTrait(TRAIT.FELL_BEACON)
    },
    {
      kind: 'flat',
      source: 'Signet of Spite',
      to: 'Power',
      amount: balanceProfileNumber(signetOfSpitePassiveProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasSelectedSkill(ID.SIGNET_OF_SPITE)
    }
  ];

  if (hasTrait(TRAIT.BARBED_PRECISION)) {
    const barbedPrecisionProfile = requireBalanceProfileFromContext(profileContext, TRAIT.BARBED_PRECISION);
    traitDurations['Bleeding Duration'] =
      balanceProfileNumber(barbedPrecisionProfile, 'conditionDurationMultiplier') * 100 - 100;
  }

  // Finalization merges profession effects with the common equipment-derived attribute result.
  return finalizeProfessionBuildAttributes(common, {
    activeTraits,
    attributeEffects,
    traitDurations,
    traitCriticalChance: hasTrait(TRAIT.DEATH_PERCEPTION)
      ? balanceProfileNumber(
          requireBalanceProfileFromContext(profileContext, TRAIT.DEATH_PERCEPTION),
          'criticalChance'
        ) * 100
      : 0
  });
}
