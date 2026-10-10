import type { Gw2BuildAttributeRuleContext, Gw2CommonAttributeResult } from '#gw2/platform/builds/types.js';
import { revenantCatalog } from '#gw2/professions/revenant/catalog.js';
import { getActiveTraits } from '#gw2/professions/revenant/data/traits-data.js';
import {
  createBuildAttributeContext,
  finalizeProfessionBuildAttributes
} from '#gw2/professions/shared/build-attributes.js';

/** Finalizes the selected trait owners' contributions through the shared attribute pipeline. */
export function applyRevenantBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  context: Gw2BuildAttributeRuleContext
) {
  const { activeTraits, profileContext } = createBuildAttributeContext(context, revenantCatalog, getActiveTraits);
  return finalizeProfessionBuildAttributes(common, { activeTraits, profileContext }, context);
}
