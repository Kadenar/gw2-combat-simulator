import { balanceProfileNumberFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
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
  { build, selectedSkills = [], disabledTrait = null, balanceContext }: Gw2BuildAttributeRuleContext
): Gw2FinalizedAttributeResult {
  const mesmerBuild = build as MesmerBuild;
  // Attribute amounts follow the selected patch while effect ordering and eligibility remain unchanged.
  const profileContext = balanceContext ?? { catalog: mesmerCatalog };
  const traitDurations: Gw2NumericAttributes = {};

  const { activeTraits, hasTrait, hasSelectedSkill, hasSelectedSkillId } = createBuildAttributeContext({
    specializations: mesmerBuild.specializations || [],
    selectedSkills,
    disabledTrait,
    getActiveTraits
  });

  const assumptions = mesmerBuild.assumptions || {};

  const attributeEffects: Gw2AttributeEffect[] = [
    {
      kind: 'conversion',
      source: 'Quiet Intensity',
      from: 'Vitality',
      to: 'Ferocity',
      multiplier: balanceProfileNumberFromContext(profileContext, TRAIT.QUIET_INTENSITY, 'vitalityConversion'),
      rounding: 'round',
      input: 'common',
      enabled: hasTrait('Quiet Intensity')
    },
    {
      kind: 'flat',
      source: 'Chaotic Persistence',
      to: 'Expertise',
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.CHAOTIC_PERSISTENCE, 'expertiseBonus'),
      feedsConversions: false,
      enabled: hasTrait('Chaotic Persistence') && assumptions.regeneration !== false
    },
    {
      kind: 'flat',
      source: 'Chaotic Persistence',
      to: 'Concentration',
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.CHAOTIC_PERSISTENCE, 'concentrationBonus'),
      feedsConversions: false,
      enabled: hasTrait('Chaotic Persistence') && assumptions.regeneration !== false
    },
    {
      kind: 'flat',
      source: 'Sharpening Sorrow',
      to: 'Expertise',
      amount: balanceProfileNumberFromContext(profileContext, TRAIT.SHARPENING_SORROW, 'expertiseBonus'),
      feedsConversions: false,
      enabled: hasTrait('Sharpening Sorrow') && assumptions.fury !== false
    },
    {
      kind: 'flat',
      source: 'Signet of Domination',
      to: 'Condition Damage',
      amount: balanceProfileNumberFromContext(
        profileContext,
        'mesmer.core.signet-of-domination-passive',
        'conditionDamageBonus'
      ),
      feedsConversions: false,
      enabled: hasSelectedSkillId(10232) || hasSelectedSkill('Signet of Domination')
    },
    {
      kind: 'flat',
      source: 'Signet of Midnight',
      to: 'Expertise',
      amount: balanceProfileNumberFromContext(
        profileContext,
        'mesmer.core.signet-of-midnight-passive',
        'expertiseBonus'
      ),
      feedsConversions: false,
      enabled: hasSelectedSkillId(10234) || hasSelectedSkill('Signet of Midnight')
    }
  ];

  let traitCriticalChance = 0;

  // Duration bonuses come from profiles, not metadata annotations.
  if (hasTrait('Malicious Sorcery'))
    traitDurations['Confusion Duration'] =
      100 * balanceProfileNumberFromContext(profileContext, TRAIT.MALICIOUS_SORCERY, 'durationMultiplier');

  if (hasTrait('Quiet Intensity') && assumptions.fury !== false) {
    traitCriticalChance +=
      100 * balanceProfileNumberFromContext(profileContext, TRAIT.QUIET_INTENSITY, 'criticalChance');
  }

  if (hasTrait('Flow of Time') && assumptions.alacrity !== false) {
    traitCriticalChance += 100 * balanceProfileNumberFromContext(profileContext, TRAIT.FLOW_OF_TIME, 'criticalChance');
  }

  return finalizeProfessionBuildAttributes(common, {
    activeTraits,
    attributeEffects,
    traitDurations,
    traitCriticalChance
  });
}
