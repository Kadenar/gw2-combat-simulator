import type { Gw2BuildAttributeRuleContext, Gw2CommonAttributeResult } from '#gw2/platform/builds/types.js';
import { guardianCatalog } from '#gw2/professions/guardian/catalog.js';
import { getActiveTraits } from '#gw2/professions/guardian/data/traits-data.js';
import {
  createBuildAttributeContext,
  finalizeProfessionBuildAttributes
} from '#gw2/professions/shared/build-attributes.js';
/** Resolve selections once; the shared evaluator owns every trait and skill contribution. */
export function applyGuardianBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  context: Gw2BuildAttributeRuleContext
) {
  const { activeTraits, profileContext } = createBuildAttributeContext(context, guardianCatalog, getActiveTraits);
  return finalizeProfessionBuildAttributes(common, { activeTraits, profileContext }, context);
}
