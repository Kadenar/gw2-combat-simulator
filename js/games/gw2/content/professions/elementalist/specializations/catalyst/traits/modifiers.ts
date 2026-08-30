import { MODIFIER_TARGET } from '../../../../../../platform/combat/modifiers/rules.js';
import type { Gw2ModifierRule } from '../../../../../../platform/combat/modifiers/types.js';
import { hasTrait } from '../../../../../../platform/combat/state/traits.js';
import { elementalistTimedBuffStacks } from '../../../core/traits/modifiers.js';

export const catalystModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'elementalist.empowering-auras-strike',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    parameters: { maximumStacks: 5, damagePerStack: 0.01 } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      elementalistTimedBuffStacks(context, 'empowering auras', parameters.maximumStacks) * parameters.damagePerStack,
    when: (context) => hasTrait(context, 'Empowering Auras')
  },
  {
    id: 'elementalist.empowering-auras-condition',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    parameters: { maximumStacks: 5, damagePerStack: 0.01 } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      elementalistTimedBuffStacks(context, 'empowering auras', parameters.maximumStacks) * parameters.damagePerStack,
    when: (context) => hasTrait(context, 'Empowering Auras')
  },
  {
    id: 'elementalist.relentless-fire',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) => elementalistTimedBuffStacks(context, 'relentless fire', 1) > 0
  }
]);
