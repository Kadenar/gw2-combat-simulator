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
import { guardianCatalog } from '#gw2/professions/guardian/catalog.js';
import { perfectInscriptionsMultiplier } from '#gw2/professions/guardian/core/traits/behavior.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { getActiveTraits } from '#gw2/professions/guardian/data/traits-data.js';
import {
  createBuildAttributeContext,
  finalizeProfessionBuildAttributes
} from '#gw2/professions/shared/build-attributes.js';

// Skill-owned signet passives use the selected Perfect Inscriptions multiplier;
// registered trait owners supply the remaining build contributions.
export function applyGuardianBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  context: Gw2BuildAttributeRuleContext
): Gw2FinalizedAttributeResult {
  const { activeTraits, hasSelectedSkill, profileContext } = createBuildAttributeContext(
    context,
    guardianCatalog,
    getActiveTraits
  );

  const signetMultiplier = perfectInscriptionsMultiplier({
    ...profileContext,
    selectedTraitIds: activeTraits.map((trait) => trait.id)
  });

  const baneSignetPassiveProfile = requireBalanceProfileFromContext(
    profileContext,
    'guardian.core.bane-signet-passive'
  );
  const signetOfWrathPassiveProfile = requireBalanceProfileFromContext(
    profileContext,
    'guardian.core.signet-of-wrath-passive'
  );
  const attributeEffects: readonly Gw2AttributeEffect[] = [
    {
      kind: 'flat',
      source: 'Bane Signet',
      to: 'Power',
      amount: balanceProfileNumber(baneSignetPassiveProfile, 'attributeBonus') * signetMultiplier,
      feedsConversions: false,
      enabled: hasSelectedSkill(ID.BANE_SIGNET)
    },
    {
      kind: 'flat',
      source: 'Signet of Wrath',
      to: 'Condition Damage',
      amount: balanceProfileNumber(signetOfWrathPassiveProfile, 'attributeBonus') * signetMultiplier,
      feedsConversions: false,
      enabled: hasSelectedSkill(ID.SIGNET_OF_WRATH)
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
