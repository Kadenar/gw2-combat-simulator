import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import type { Gw2NumericStatKey, Gw2ResolvedStats } from '#gw2/platform/combat/query/combat-query.js';
import {
  applyArachnophobiaPetAttributes,
  applyWellspringPetAttributes
} from '#gw2/professions/ranger/core/traits/behavior.js';
import { rangerBoonActive, rangerPetEvent } from '#gw2/professions/ranger/core/traits/modifier-queries.js';
import type { RangerModifierContext } from '#gw2/professions/ranger/types.js';

/** Owns Ranger pet-audience attributes and rules so player modifier composition stays explicit. */

/** Preserves the family bonus before Wellspring's independent-pet conversion. */
export function modifyRangerPetAttributes(
  context: RangerModifierContext,
  result: { -readonly [Key in keyof Gw2ResolvedStats]: Gw2ResolvedStats[Key] },
  staticRulesApplied: boolean
): void {
  if (!rangerPetEvent(context)) return;
  const adjust = (attribute: Gw2NumericStatKey, amount: number): void => {
    result[attribute] = (result[attribute] || 0) + amount;
  };

  applyArachnophobiaPetAttributes(context, adjust);
  applyWellspringPetAttributes(context, result, adjust, staticRulesApplied);
}

export const rangerPetModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'ranger.sic-em-pet',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.4,
    when: (context) => rangerPetEvent(context) && rangerBoonActive(context, 'sic-em-pet')
  }
]);
