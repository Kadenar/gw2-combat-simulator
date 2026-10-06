import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Gw2Stats } from '#gw2/platform/combat/stats.js';
import { cloneNecromancerAttributes } from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';
import {
  modifyAlchemicVigorAttributes,
  modifyDarkGunslingerAttributes,
  modifyImplacableFoeAttributes,
  modifyTwistedMedicineAttributes
} from '#gw2/professions/necromancer/specializations/harbinger/traits/behavior.js';

/** Applies Harbinger vitality and vitality-derived conversions when the build layer has not. */
function modifyHarbingerAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const result = cloneNecromancerAttributes(attributes);
  if (!professionStaticRulesApplied(context.config)) {
    // Alchemic Vigor is the minor adept trait; the specialization check lets it apply even when only the
    // spec is selected without the trait being explicitly listed (e.g. from the specialization line bonus).
    modifyAlchemicVigorAttributes(context, result);

    modifyImplacableFoeAttributes(context, result);

    modifyTwistedMedicineAttributes(context, result);

    modifyDarkGunslingerAttributes(context, result);
  }

  return result;
}

export const harbingerModifiers = Object.freeze({
  modifyAttributes: modifyHarbingerAttributes
});
