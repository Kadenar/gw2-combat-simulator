import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Gw2Stats } from '#gw2/platform/combat/stats.js';
import { cloneNecromancerAttributes } from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';
import {
  modifyFellBeaconAttributes,
  modifySandSageAttributes
} from '#gw2/professions/necromancer/specializations/scourge/traits/behavior.js';

// Apply Scourge's static conversion and live-shade attribute bonuses from their authoritative inputs.
function modifyScourgeAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  const result = cloneNecromancerAttributes(attributes);
  modifyFellBeaconAttributes(context, result);

  modifySandSageAttributes(context, result);

  return result;
}

export const scourgeModifiers = Object.freeze({
  modifyAttributes: modifyScourgeAttributes
});
