import type {
  Gw2AttributeEffect,
  Gw2BuildAttributeRuleContext,
  Gw2CommonAttributeResult,
  Gw2FinalizedAttributeResult
} from '#gw2/platform/builds/types.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/catalog.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { getActiveTraits } from '#gw2/professions/elementalist/data/traits-data.js';
import {
  createBuildAttributeContext,
  finalizeProfessionBuildAttributes
} from '#gw2/professions/shared/build-attributes.js';

/** Combines the equipped signet passive with registered trait contributions for the panel and simulation. */
export function applyElementalistBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  context: Gw2BuildAttributeRuleContext
): Gw2FinalizedAttributeResult {
  const { activeTraits, hasSelectedSkillId, profileContext } = createBuildAttributeContext(
    context,
    elementalistCatalog,
    getActiveTraits
  );

  const signetOfFirePassiveProfile = requireBalanceProfileFromContext(
    profileContext,
    'elementalist.core.signet-of-fire-passive'
  );
  // Every effect here is declarative: the shared resolver applies flat grants first, then
  // conversions. `input: 'common'` converts from the pre-effect totals and
  // `feedsConversions: false` keeps a flat grant out of any conversion's input.
  const attributeEffects: readonly Gw2AttributeEffect[] = [
    {
      kind: 'flat',
      to: 'Precision',
      amount: balanceProfileNumber(signetOfFirePassiveProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasSelectedSkillId(ID.SIGNET_OF_FIRE)
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
