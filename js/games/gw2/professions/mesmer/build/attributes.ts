import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerCatalog } from '#gw2/professions/mesmer/catalog.js';
import { getActiveTraits } from '#gw2/professions/mesmer/data/traits-data.js';

import {
  createBuildAttributeContext,
  finalizeProfessionBuildAttributes
} from '#gw2/professions/shared/build-attributes.js';
import type {
  Gw2AttributeEffect,
  Gw2CommonAttributeResult,
  Gw2BuildAttributeRuleContext,
  Gw2FinalizedAttributeResult,
  Gw2NumericAttributes
} from '#gw2/platform/builds/types.js';
import type { MesmerBuild } from '#gw2/professions/mesmer/types.js';

// Fold Mesmer trait conversions, selected-signet bonuses, duration bonuses, and
// assumption-dependent critical chance into the shared build attribute result.
export function applyMesmerBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  context: Gw2BuildAttributeRuleContext
): Gw2FinalizedAttributeResult {
  const mesmerBuild = context.build as MesmerBuild;
  const traitDurations: Gw2NumericAttributes = {};

  const { activeTraits, hasTrait, hasSelectedSkill, profileContext } = createBuildAttributeContext(
    context,
    mesmerCatalog,
    getActiveTraits
  );

  const assumptions = mesmerBuild.assumptions || {};

  const quietIntensityProfile = requireBalanceProfileFromContext(profileContext, TRAIT.QUIET_INTENSITY);
  const chaoticPersistenceProfile = requireBalanceProfileFromContext(profileContext, TRAIT.CHAOTIC_PERSISTENCE);
  const sharpeningSorrowProfile = requireBalanceProfileFromContext(profileContext, TRAIT.SHARPENING_SORROW);
  const signetOfDominationPassiveProfile = requireBalanceProfileFromContext(
    profileContext,
    'mesmer.core.signet-of-domination-passive'
  );
  const signetOfMidnightPassiveProfile = requireBalanceProfileFromContext(
    profileContext,
    'mesmer.core.signet-of-midnight-passive'
  );
  const attributeEffects: Gw2AttributeEffect[] = [
    {
      kind: 'conversion',
      source: 'Quiet Intensity',
      from: 'Vitality',
      to: 'Ferocity',
      multiplier: balanceProfileNumber(quietIntensityProfile, 'vitalityConversion'),
      rounding: 'round',
      input: 'common',
      enabled: hasTrait(TRAIT.QUIET_INTENSITY)
    },
    {
      kind: 'flat',
      source: 'Chaotic Persistence',
      to: 'Expertise',
      amount: balanceProfileNumber(chaoticPersistenceProfile, 'expertiseBonus'),
      feedsConversions: false,
      enabled: hasTrait(TRAIT.CHAOTIC_PERSISTENCE) && assumptions.regeneration !== false
    },
    {
      kind: 'flat',
      source: 'Chaotic Persistence',
      to: 'Concentration',
      amount: balanceProfileNumber(chaoticPersistenceProfile, 'concentrationBonus'),
      feedsConversions: false,
      enabled: hasTrait(TRAIT.CHAOTIC_PERSISTENCE) && assumptions.regeneration !== false
    },
    {
      kind: 'flat',
      source: 'Sharpening Sorrow',
      to: 'Expertise',
      amount: balanceProfileNumber(sharpeningSorrowProfile, 'expertiseBonus'),
      feedsConversions: false,
      enabled: hasTrait(TRAIT.SHARPENING_SORROW) && assumptions.fury !== false
    },
    {
      kind: 'flat',
      source: 'Signet of Domination',
      to: 'Condition Damage',
      amount: balanceProfileNumber(signetOfDominationPassiveProfile, 'conditionDamageBonus'),
      feedsConversions: false,
      enabled: hasSelectedSkill(ID.SIGNET_OF_DOMINATION)
    },
    {
      kind: 'flat',
      source: 'Signet of Midnight',
      to: 'Expertise',
      amount: balanceProfileNumber(signetOfMidnightPassiveProfile, 'expertiseBonus'),
      feedsConversions: false,
      enabled: hasSelectedSkill(ID.SIGNET_OF_MIDNIGHT)
    }
  ];

  let traitCriticalChance = 0;

  // Duration bonuses come from profiles, not metadata annotations.
  if (hasTrait(TRAIT.MALICIOUS_SORCERY))
    traitDurations['Confusion Duration'] =
      100 *
      balanceProfileNumber(
        requireBalanceProfileFromContext(profileContext, TRAIT.MALICIOUS_SORCERY),
        'durationMultiplier'
      );

  if (hasTrait(TRAIT.QUIET_INTENSITY) && assumptions.fury !== false) {
    traitCriticalChance += 100 * balanceProfileNumber(quietIntensityProfile, 'criticalChance');
  }

  if (hasTrait(TRAIT.FLOW_OF_TIME) && assumptions.alacrity !== false) {
    const flowOfTimeProfile = requireBalanceProfileFromContext(profileContext, TRAIT.FLOW_OF_TIME);
    traitCriticalChance += 100 * balanceProfileNumber(flowOfTimeProfile, 'criticalChance');
  }

  return finalizeProfessionBuildAttributes(common, {
    activeTraits,
    attributeEffects,
    traitDurations,
    traitCriticalChance
  });
}
