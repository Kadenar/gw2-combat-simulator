import type {
  Gw2AttributeEffect,
  Gw2BuildAttributeRuleContext,
  Gw2CommonAttributeResult,
  Gw2FinalizedAttributeResult,
  Gw2NumericAttributes
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

/**
 * The Elementalist's profession-specific half of attribute calculation: it declares the
 * trait and signet effects the shared calculator cannot know about, and returns the
 * finalized attribute set the simulation and the editor's attribute panel both read.
 */
// Fold build-time trait, weapon, and selected-skill bonuses into the common
// attributes while preserving trait-duration and provenance metadata.
export function applyElementalistBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  context: Gw2BuildAttributeRuleContext
): Gw2FinalizedAttributeResult {
  const traitDurations: Gw2NumericAttributes = {};

  const { activeTraits, hasSelectedSkill, profileContext } = createBuildAttributeContext(
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
      source: 'Signet of Fire',
      to: 'Precision',
      amount: balanceProfileNumber(signetOfFirePassiveProfile, 'attributeBonus'),
      feedsConversions: false,
      enabled: hasSelectedSkill(ID.SIGNET_OF_FIRE)
    }
  ];

  return finalizeProfessionBuildAttributes(
    common,
    {
      activeTraits,
      attributeEffects,
      traitDurations,
      traitCriticalChance: 0
    },
    context
  );
}
