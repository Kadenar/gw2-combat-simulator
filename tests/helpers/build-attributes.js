import { calculateCommonAttributes } from '#gw2/platform/attributes/calculation.js';
import { attributeSeedFromCommon } from '#gw2/platform/attributes/inputs.js';
import {
  createBuildAttributeContext,
  finalizeProfessionBuildAttributes
} from '#gw2/professions/shared/build-attributes.js';
import { selectedTraits } from '#gw2/professions/shared/trait-data.js';

/** Exercise the shared evaluator with explicit test selections without constructing an application build context. */
export function createProfessionBuildAttributeRules(catalog) {
  return (common, context) =>
    finalizeProfessionBuildAttributes(
      common,
      attributeSeedFromCommon(common),
      createBuildAttributeContext(context, catalog, (selections) =>
        selectedTraits(context.balanceContext?.catalog ?? catalog, selections)
      ),
      context
    );
}

/** Prepare equipment and trait inputs for focused attribute tests using the production calculation primitives. */
export function createCalculateAttributes(applyBuildAttributeRules, attributeContributions) {
  return function calculateAttributes(
    build,
    selectedSkills = [],
    weaponSet = 1,
    disabledTrait = null,
    disabledSigil = null,
    balanceContext
  ) {
    const common = calculateCommonAttributes(build, { weaponSet, disabledSigil });
    return applyBuildAttributeRules(common, {
      build,
      selectedSkills,
      weaponSet,
      disabledTrait,
      balanceContext,
      attributeContributions
    });
  };
}
