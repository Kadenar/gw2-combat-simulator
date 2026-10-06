import {
  applySecondOpinionAttributes,
  applyStrengthOfShadowsAttributes
} from '#gw2/professions/thief/specializations/specter/traits/behavior.js';

import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';

import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/stats.js';

function modifySpecterAttributes(context: Gw2ModifierContext, attributes: Gw2ResolvedStats): Gw2ResolvedStats {
  if (professionStaticRulesApplied(context.config)) return attributes;
  const result = { ...attributes };
  // Conversions read gear-only stats. config.stats excludes might
  // (baked into the seed's condition damage) and live trait bonuses.
  // Using gear stats directly avoids double-counting the flat bonuses added below.

  applySecondOpinionAttributes(context, result);

  applyStrengthOfShadowsAttributes(context, result);

  return result;
}

export const specterModifiers = Object.freeze({
  modifyAttributes: modifySpecterAttributes
});
