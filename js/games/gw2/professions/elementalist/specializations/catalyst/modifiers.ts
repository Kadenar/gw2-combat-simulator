import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { activeBuffStacks } from '#gw2/platform/combat/query/runtime-query.js';

/** Relentless Fire retains its skill-owned damage windows; trait rules come from registered definitions. */
export const catalystModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'elementalist.relentless-fire',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) => activeBuffStacks(context, 'relentless fire', 1) > 0
  },
  {
    id: 'elementalist.relentless-fire-condition',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) => activeBuffStacks(context, 'relentless fire', 1) > 0
  }
]);

/** Catalyst modifiers: declarative buff-driven damage rules plus the Elemental Empowerment attribute conversion. */
export const catalystModifiers = {
  modifierRules: catalystModifierRules
};
