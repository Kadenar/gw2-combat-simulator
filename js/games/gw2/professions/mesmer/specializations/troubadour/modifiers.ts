import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { illusionSource } from '#gw2/professions/mesmer/core/mechanics/modifier-queries.js';
import { hasLute } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instrument-queries.js';
import { applyTroubadourAttributes } from '#gw2/professions/mesmer/specializations/troubadour/traits/performance.js';

import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';

export const troubadourModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'mesmer.lute',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    amount: 0.1,
    // Lute Playing buffs only the Troubadour, so illusion attacks must not inherit its damage bonus.
    when: (context) => hasLute(context) && !illusionSource(context)
  }
]);

export const troubadourModifiers = Object.freeze({
  modifyAttributes: applyTroubadourAttributes,
  modifierRules: troubadourModifierRules
});
