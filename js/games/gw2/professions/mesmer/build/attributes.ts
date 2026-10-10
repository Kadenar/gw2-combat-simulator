import type { Gw2BuildAttributeRuleContext, Gw2CommonAttributeResult } from '#gw2/platform/builds/types.js';
import { mesmerCatalog } from '#gw2/professions/mesmer/catalog.js';
import { getActiveTraits } from '#gw2/professions/mesmer/data/traits-data.js';
import {
  createBuildAttributeContext,
  finalizeProfessionBuildAttributes
} from '#gw2/professions/shared/build-attributes.js';
/** Resolve selections once; the shared evaluator owns every trait and skill contribution. */
export function applyMesmerBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  context: Gw2BuildAttributeRuleContext
) {
  const { activeTraits, profileContext } = createBuildAttributeContext(context, mesmerCatalog, getActiveTraits);
  return finalizeProfessionBuildAttributes(common, { activeTraits, profileContext }, context);
}
