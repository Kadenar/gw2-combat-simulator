import { THIEF_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/thief/core/profiles.js';
import { thiefCatalog } from '#gw2/professions/thief/catalog.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { getActiveTraits } from '#gw2/professions/thief/data/traits-data.js';
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
import type { ThiefBuild } from '#gw2/professions/thief/types.js';

export function applyThiefBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  context: Gw2BuildAttributeRuleContext
): Gw2FinalizedAttributeResult {
  const thiefBuild = context.build as ThiefBuild;

  const { activeTraits, hasTrait, hasSelectedSkill, profileContext, weapons } = createBuildAttributeContext(
    context,
    thiefCatalog,
    getActiveTraits
  );

  const traitDurations: Gw2NumericAttributes = {};

  const secondOpinionProfile = requireBalanceProfileFromContext(profileContext, TRAIT.SECOND_OPINION);
  const daggerTrainingProfile = requireBalanceProfileFromContext(profileContext, TRAIT.DAGGER_TRAINING);
  const deadlyAmbitionProfile = requireBalanceProfileFromContext(profileContext, TRAIT.DEADLY_AMBITION);
  const revealedTrainingProfile = requireBalanceProfileFromContext(profileContext, TRAIT.REVEALED_TRAINING);
  const noQuarterProfile = requireBalanceProfileFromContext(profileContext, TRAIT.NO_QUARTER);
  const preparednessProfile = requireBalanceProfileFromContext(profileContext, TRAIT.PREPAREDNESS);
  const staffMasterProfile = requireBalanceProfileFromContext(profileContext, TRAIT.STAFF_MASTER);
  const swindlersEquilibriumProfile = requireBalanceProfileFromContext(profileContext, TRAIT.SWINDLERS_EQUILIBRIUM);
  const silentScopeProfile = requireBalanceProfileFromContext(profileContext, TRAIT.SILENT_SCOPE);
  const premeditationProfile = requireBalanceProfileFromContext(profileContext, TRAIT.PREMEDITATION);
  const practicedToleranceProfile = requireBalanceProfileFromContext(profileContext, TRAIT.PRACTICED_TOLERANCE);
  const maraudersResilienceProfile = requireBalanceProfileFromContext(profileContext, TRAIT.MARAUDERS_RESILIENCE);
  const strengthOfShadowsProfile = requireBalanceProfileFromContext(profileContext, TRAIT.STRENGTH_OF_SHADOWS);
  const assassinsSignetProfile = requireBalanceProfileFromContext(profileContext, 'thief.core.assassins-signet');
  const signetOfAgilityProfile = requireBalanceProfileFromContext(profileContext, CORE.signetOfAgility);
  const attributeEffects: readonly Gw2AttributeEffect[] = [
    {
      kind: 'flat',
      source: 'Dagger Training',
      to: 'Power',
      amount: balanceProfileNumber(
        daggerTrainingProfile,
        weapons.includes('Dagger') ? 'weaponAttributeBonus' : 'attributeBonus'
      ),
      feedsConversions: true,
      enabled: hasTrait(TRAIT.DAGGER_TRAINING)
    },
    {
      kind: 'flat',
      source: 'Deadly Ambition',
      to: 'Condition Damage',
      amount: balanceProfileNumber(deadlyAmbitionProfile, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait(TRAIT.DEADLY_AMBITION)
    },
    {
      kind: 'flat',
      source: 'Revealed Training',
      to: 'Power',
      amount: balanceProfileNumber(revealedTrainingProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait(TRAIT.REVEALED_TRAINING)
    },
    {
      kind: 'flat',
      source: 'No Quarter',
      to: 'Ferocity',
      amount: balanceProfileNumber(noQuarterProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait(TRAIT.NO_QUARTER) && Boolean(thiefBuild.assumptions?.fury)
    },
    {
      kind: 'flat',
      source: 'Preparedness',
      to: 'Expertise',
      amount: balanceProfileNumber(preparednessProfile, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait(TRAIT.PREPAREDNESS)
    },
    {
      kind: 'flat',
      source: 'Staff Master',
      to: 'Power',
      amount: balanceProfileNumber(
        staffMasterProfile,
        weapons.includes('Staff') ? 'weaponAttributeBonus' : 'attributeBonus'
      ),
      feedsConversions: true,
      enabled: hasTrait(TRAIT.STAFF_MASTER)
    },
    {
      kind: 'flat',
      source: "Swindler's Equilibrium",
      to: 'Power',
      amount: balanceProfileNumber(
        swindlersEquilibriumProfile,
        weapons.includes('Sword') ? 'weaponAttributeBonus' : 'attributeBonus'
      ),
      feedsConversions: true,
      enabled: hasTrait(TRAIT.SWINDLERS_EQUILIBRIUM)
    },
    {
      kind: 'flat',
      source: 'Silent Scope',
      to: 'Precision',
      amount: balanceProfileNumber(silentScopeProfile, 'attributeBonus'),
      feedsConversions: true,
      enabled: hasTrait(TRAIT.SILENT_SCOPE)
    },
    {
      kind: 'flat',
      source: 'Premeditation',
      to: 'Concentration',
      amount: balanceProfileNumber(premeditationProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasTrait(TRAIT.PREMEDITATION)
    },
    {
      kind: 'flat',
      source: 'Second Opinion',
      to: 'Condition Damage',
      amount:
        balanceProfileNumber(secondOpinionProfile, 'attributeBonus') +
        (weapons.includes('Scepter') ? balanceProfileNumber(secondOpinionProfile, 'attributePerStack') : 0),
      feedsConversions: true,
      enabled: hasTrait(TRAIT.SECOND_OPINION)
    },
    {
      kind: 'conversion',
      source: 'Practiced Tolerance',
      from: 'Precision',
      to: 'Ferocity',
      multiplier: balanceProfileNumber(practicedToleranceProfile, 'attributeConversion'),
      rounding: 'round',
      input: 'eligible',
      enabled: hasTrait(TRAIT.PRACTICED_TOLERANCE)
    },
    {
      kind: 'conversion',
      source: "Marauder's Resilience",
      from: 'Power',
      to: 'Vitality',
      multiplier: balanceProfileNumber(maraudersResilienceProfile, 'attributeConversion'),
      rounding: 'round',
      input: 'eligible',
      enabled: hasTrait(TRAIT.MARAUDERS_RESILIENCE)
    },
    {
      kind: 'conversion',
      source: 'Second Opinion',
      from: 'Condition Damage',
      to: 'Healing Power',
      multiplier: balanceProfileNumber(secondOpinionProfile, 'attributeConversion'),
      rounding: 'round',
      input: 'eligible',
      enabled: hasTrait(TRAIT.SECOND_OPINION)
    },
    {
      kind: 'conversion',
      source: 'Strength of Shadows',
      from: 'Vitality',
      to: 'Expertise',
      multiplier: balanceProfileNumber(strengthOfShadowsProfile, 'attributeConversion'),
      rounding: 'round',
      input: 'eligible',
      enabled: hasTrait(TRAIT.STRENGTH_OF_SHADOWS)
    },
    {
      kind: 'flat',
      source: "Assassin's Signet",
      to: 'Power',
      amount: balanceProfileNumber(assassinsSignetProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasSelectedSkill(ID.ASSASSINS_SIGNET)
    },
    {
      // The equipped signet contributes panel precision while its passive is available.
      kind: 'flat',
      source: 'Signet of Agility',
      to: 'Precision',
      amount: balanceProfileNumber(signetOfAgilityProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasSelectedSkill(ID.SIGNET_OF_AGILITY)
    }
  ];

  // Static condition-duration traits belong in panel stats so simulation provenance can prevent rebaking them.
  if (hasTrait(TRAIT.POTENT_POISON)) {
    const potentPoisonProfile = requireBalanceProfileFromContext(profileContext, TRAIT.POTENT_POISON);
    traitDurations['Poison Duration'] = 100 * balanceProfileNumber(potentPoisonProfile, 'conditionDurationBonus');
  }

  return finalizeProfessionBuildAttributes(common, {
    activeTraits,
    attributeEffects,
    traitDurations
  });
}
