import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { elementalistTimedBuffStacks } from '#gw2/professions/elementalist/core/mechanics/modifier-queries.js';
import { applyElementalEmpowermentAttributes } from '#gw2/professions/elementalist/specializations/catalyst/traits/empowerment.js';

/** Relentless Fire retains its skill-owned damage windows; trait rules come from registered definitions. */
export const catalystModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'elementalist.relentless-fire',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) => elementalistTimedBuffStacks(context, 'relentless fire', 1) > 0
  },
  {
    id: 'elementalist.relentless-fire-condition',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) => elementalistTimedBuffStacks(context, 'relentless fire', 1) > 0
  }
]);

/** Catalyst modifiers: declarative buff-driven damage rules plus the Elemental Empowerment attribute conversion. */
export const catalystModifiers = {
  modifyAttributes: applyElementalEmpowermentAttributes,
  modifierRules: catalystModifierRules
};
