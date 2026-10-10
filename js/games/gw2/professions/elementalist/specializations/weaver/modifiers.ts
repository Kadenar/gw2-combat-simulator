import { activeBuffStacks } from '#gw2/platform/combat/query/runtime-query.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';

/** Weave Self retains its skill-owned damage windows; trait rules come from registered definitions. */
export const weaverModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'elementalist.weave-self-air',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) => activeBuffStacks(context, 'weave self air', 1) > 0
  },
  {
    id: 'elementalist.weave-self-fire',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    amount: 0.2,
    when: (context) => activeBuffStacks(context, 'weave self fire', 1) > 0
  }
]);

/** Weave Self damage remains skill-owned; selected traits supply attribute contributions. */
export const weaverModifiers = {
  modifierRules: weaverModifierRules
};
