import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { revenantTimedBuff } from '#gw2/professions/revenant/core/modifiers.js';
import { modifyHeraldPassiveAttributes } from '#gw2/professions/revenant/specializations/herald/mechanics/facet-passives.js';

const heraldModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'revenant.burst-of-strength-strike',
    order: 101,
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    // "burst-of-strength" is a timed buff key written by the skill handler, not a boon; it uses revenantTimedBuff rather than boon tracking.
    amount: 0.1,
    when: (context) => revenantTimedBuff(context, 'burst-of-strength')
  },
  {
    id: 'revenant.burst-of-strength-condition',
    order: 102,
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    amount: 0.05,
    when: (context) => revenantTimedBuff(context, 'burst-of-strength')
  }
]);

export const heraldModifiers = Object.freeze({
  modifierRules: heraldModifierRules,
  modifyAttributes: modifyHeraldPassiveAttributes
});
