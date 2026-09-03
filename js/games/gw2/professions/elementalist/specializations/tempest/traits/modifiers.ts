import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import { elementalistTimedBuffStacks } from '#gw2/professions/elementalist/core/traits/modifiers.js';

/**
 * Damage modifiers for the two Tempest buffs tracked as timed applications: Tempestuous Aria
 * (refreshed by auras) and Transcendent Tempest (stamped when an overload completes). Each rule
 * requires both the trait and a live application of its buff kind at the event's time.
 */
export const tempestModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'elementalist.tempestuous-aria-strike',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) =>
      hasTrait(context, 'Tempestuous Aria') && elementalistTimedBuffStacks(context, 'tempestuous aria', 1) > 0
  },
  {
    id: 'elementalist.tempestuous-aria-condition',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    amount: 0.05,
    when: (context) =>
      hasTrait(context, 'Tempestuous Aria') && elementalistTimedBuffStacks(context, 'tempestuous aria', 1) > 0
  },
  {
    id: 'elementalist.transcendent-tempest-strike',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.25,
    when: (context) =>
      hasTrait(context, 'Transcendent Tempest') && elementalistTimedBuffStacks(context, 'transcendent-tempest', 1) > 0
  },
  {
    id: 'elementalist.transcendent-tempest-condition',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    amount: 0.2,
    when: (context) =>
      hasTrait(context, 'Transcendent Tempest') && elementalistTimedBuffStacks(context, 'transcendent-tempest', 1) > 0
  }
]);
