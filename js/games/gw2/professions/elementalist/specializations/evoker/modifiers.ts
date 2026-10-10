import { activeBuffStacks } from '#gw2/platform/combat/query/runtime-query.js';

import type { ElementalistModifierContext } from '#gw2/professions/elementalist/types.js';

import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';

const evokerModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'elementalist.zap',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.03,
    when: (context: ElementalistModifierContext) =>
      context.config?.evokerElement === 'Air' && activeBuffStacks(context, 'zap buff', 1) > 0
  }
]);

/** Zap retains its skill-owned rule; selected traits supply attribute contributions. */
export const evokerModifiers = Object.freeze({
  modifierRules: evokerModifierRules
});
