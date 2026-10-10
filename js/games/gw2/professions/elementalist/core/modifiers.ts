import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { activeBuffStacks } from '#gw2/platform/combat/query/runtime-query.js';
import { wieldedConjure } from '#gw2/professions/elementalist/core/mechanics/modifier-queries.js';

/**
 * Shared resource modifiers remain here; skills and registered traits own their intrinsic rules.
 */
export const elementalistCoreModifierRules = Object.freeze<readonly Gw2ModifierRule[]>([
  {
    id: 'elementalist.hammer-fire-orb',
    target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
    operation: 'damage-additive',
    amount: 0.05,
    when: (context) => activeBuffStacks(context, 'hammer fire orb', 1) > 0
  },
  {
    id: 'elementalist.hammer-air-orb',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.15,
    when: (context) => activeBuffStacks(context, 'hammer air orb', 1) > 0
  },
  {
    id: 'elementalist.frost-bow-condition-duration',
    target: MODIFIER_TARGET.CONDITION_DURATION,
    operation: 'multiply',
    factor: 1.2,
    when: (context) => wieldedConjure(context) === 'Frost Bow'
  }
]);

export const elementalistCoreModifiers = Object.freeze({
  modifierRules: elementalistCoreModifierRules
});
