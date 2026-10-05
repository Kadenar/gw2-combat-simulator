import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { mesmerCatalog } from '#gw2/professions/mesmer/catalog.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { getActiveTraits } from '#gw2/professions/mesmer/data/traits-data.js';

import type {
  Gw2AttributeEffect,
  Gw2BuildAttributeRuleContext,
  Gw2CommonAttributeResult,
  Gw2FinalizedAttributeResult
} from '#gw2/platform/builds/types.js';
import {
  createBuildAttributeContext,
  finalizeProfessionBuildAttributes
} from '#gw2/professions/shared/build-attributes.js';

// Fold Mesmer trait conversions, selected-signet bonuses, duration bonuses, and
// assumption-dependent critical chance into the shared build attribute result.
export function applyMesmerBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  context: Gw2BuildAttributeRuleContext
): Gw2FinalizedAttributeResult {
  const { activeTraits, hasSelectedSkillId, profileContext } = createBuildAttributeContext(
    context,
    mesmerCatalog,
    getActiveTraits
  );
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
      kind: 'flat',
      to: 'Condition Damage',
      amount: balanceProfileNumber(signetOfDominationPassiveProfile, 'conditionDamageBonus'),
      feedsConversions: false,
      enabled: hasSelectedSkillId(ID.SIGNET_OF_DOMINATION)
    },
    {
      kind: 'flat',
      to: 'Expertise',
      amount: balanceProfileNumber(signetOfMidnightPassiveProfile, 'expertiseBonus'),
      feedsConversions: false,
      enabled: hasSelectedSkillId(ID.SIGNET_OF_MIDNIGHT)
    }
  ];

  return finalizeProfessionBuildAttributes(
    common,
    {
      activeTraits,
      attributeEffects
    },
    context
  );
}
