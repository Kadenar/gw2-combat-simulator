import type {
  Gw2BuildAttributeRuleContext,
  Gw2CommonAttributeResult,
  Gw2FinalizedAttributeResult
} from '#gw2/platform/builds/types.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import {
  createBuildAttributeContext,
  finalizeProfessionBuildAttributes
} from '#gw2/professions/shared/build-attributes.js';
import { thiefCatalog } from '#gw2/professions/thief/catalog.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as CORE } from '#gw2/professions/thief/core/profiles.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { getActiveTraits } from '#gw2/professions/thief/data/traits-data.js';

/** Finalize active selections and the two equipped signet passives after trait-owned contributions. */
export function applyThiefBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  context: Gw2BuildAttributeRuleContext
): Gw2FinalizedAttributeResult {
  const { activeTraits, hasSelectedSkill, profileContext } = createBuildAttributeContext(
    context,
    thiefCatalog,
    getActiveTraits
  );
  const assassinsSignetProfile = requireBalanceProfileFromContext(profileContext, 'thief.core.assassins-signet');
  const signetOfAgilityProfile = requireBalanceProfileFromContext(profileContext, CORE.signetOfAgility);
  return finalizeProfessionBuildAttributes(
    common,
    {
      activeTraits,
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Power',
          amount: balanceProfileNumber(assassinsSignetProfile, 'attributeBonus'),
          feedsConversions: false,
          enabled: hasSelectedSkill(ID.ASSASSINS_SIGNET)
        },
        {
          // The equipped signet contributes panel precision while its passive is available.
          kind: 'flat',
          to: 'Precision',
          amount: balanceProfileNumber(signetOfAgilityProfile, 'attributeBonus'),
          feedsConversions: false,
          enabled: hasSelectedSkill(ID.SIGNET_OF_AGILITY)
        }
      ]
    },
    context
  );
}
