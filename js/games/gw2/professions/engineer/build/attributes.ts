import type { Gw2BuildAttributeRuleContext, Gw2CommonAttributeResult } from '#gw2/platform/builds/types.js';
import { engineerCatalog } from '#gw2/professions/engineer/catalog.js';
import { getActiveTraits } from '#gw2/professions/engineer/data/traits-data.js';
import type { EngineerFinalizedAttributeResult } from '#gw2/professions/engineer/types.js';
import {
  createBuildAttributeContext,
  finalizeProfessionBuildAttributes
} from '#gw2/professions/shared/build-attributes.js';

/** Applies Engineer trait bonuses and exposes the pre-profession conversion pool used by Amalgam. */
export function applyEngineerBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  context: Gw2BuildAttributeRuleContext
): EngineerFinalizedAttributeResult {
  const { conversionPool: commonConversionPool } = common.commonContext;

  const { activeTraits } = createBuildAttributeContext(context, engineerCatalog, getActiveTraits);

  // Preserve the common conversion pool separately because Amalgam evolves from the pre-profession values.
  const finalized = finalizeProfessionBuildAttributes(
    common,
    {
      activeTraits
    },
    context
  );

  return {
    ...finalized,
    amalgamEvolveAttributePool: {
      ...commonConversionPool
    }
  };
}
