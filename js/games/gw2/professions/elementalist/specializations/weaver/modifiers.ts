import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { elementalistTimedBuffStacks } from '#gw2/professions/elementalist/core/mechanics/modifier-queries.js';
import { applyElementalPolyphonyAttributes } from '#gw2/professions/elementalist/specializations/weaver/traits/attunements.js';

/** Weave Self retains its skill-owned damage windows; trait rules come from registered definitions. */
export const weaverModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'elementalist.weave-self-air',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) => elementalistTimedBuffStacks(context, 'weave self air', 1) > 0
  },
  {
    id: 'elementalist.weave-self-fire',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    amount: 0.2,
    when: (context) => elementalistTimedBuffStacks(context, 'weave self fire', 1) > 0
  }
]);

/** Weaver modifiers: declarative dual-attunement rules plus the imperative attribute pass. */
export const weaverModifiers = {
  modifyAttributes: applyElementalPolyphonyAttributes,
  modifierRules: weaverModifierRules
};
