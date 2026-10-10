import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { activeBuff, rangerPetEvent } from '#gw2/professions/ranger/core/traits/modifier-queries.js';

export const rangerPetModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'ranger.sic-em-pet',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.4,
    when: (context) => rangerPetEvent(context) && activeBuff(context, 'sic-em-pet')
  }
]);
