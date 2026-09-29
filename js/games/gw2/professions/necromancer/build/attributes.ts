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
import { necromancerCatalog } from '#gw2/professions/necromancer/catalog.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { getActiveTraits } from '#gw2/professions/necromancer/data/traits-data.js';
import {
  createBuildAttributeContext,
  finalizeProfessionBuildAttributes
} from '#gw2/professions/shared/build-attributes.js';

/** Finalizes the skill-owned signet passive alongside registered trait build contributions. */
export function applyNecromancerBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  context: Gw2BuildAttributeRuleContext
): Gw2FinalizedAttributeResult {
  const { activeTraits, hasSelectedSkill, profileContext } = createBuildAttributeContext(
    context,
    necromancerCatalog,
    getActiveTraits
  );

  const signetOfSpitePassiveProfile = requireBalanceProfileFromContext(
    profileContext,
    'necromancer.core.signet-of-spite-passive'
  );
  const attributeEffects: readonly Gw2AttributeEffect[] = [
    {
      kind: 'flat',
      to: 'Power',
      amount: balanceProfileNumber(signetOfSpitePassiveProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasSelectedSkill(ID.SIGNET_OF_SPITE)
    }
  ];

  // Finalization merges profession effects with the common equipment-derived attribute result.
  return finalizeProfessionBuildAttributes(
    common,
    {
      activeTraits,
      attributeEffects
    },
    context
  );
}
