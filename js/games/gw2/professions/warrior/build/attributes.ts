import type { Gw2BuildAttributeRuleContext, Gw2CommonAttributeResult } from '#gw2/platform/builds/types.js';
import {
  createBuildAttributeContext,
  finalizeProfessionBuildAttributes
} from '#gw2/professions/shared/build-attributes.js';
import { warriorCatalog } from '#gw2/professions/warrior/catalog.js';
import { getActiveTraits } from '#gw2/professions/warrior/data/traits-data.js';
/** Resolve selections once; the shared evaluator owns every trait and skill contribution. */
export function applyWarriorBuildAttributeRules(
  common: Gw2CommonAttributeResult,
  context: Gw2BuildAttributeRuleContext
) {
  const { activeTraits, profileContext } = createBuildAttributeContext(context, warriorCatalog, getActiveTraits);
  return finalizeProfessionBuildAttributes(common, { activeTraits, profileContext }, context);
}
