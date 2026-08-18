import type { SchedulerRecord } from '../../../../platform/engine/types.js';
import { MODIFIER_TARGET } from '../../../../platform/gw2/modifier-rules.js';
import { hasTrait } from '../../../../platform/gw2/trait-state.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '../../../../platform/gw2/types.js';
import { elementalistMightStacks, elementalistTimedBuffStacks } from '../../core/modifiers.js';
import { elementalistBalanceValue } from '../../core/profiles.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

// Familiar's Prowess buffs strike for Air element, condition for Fire — damage type bonus is element-gated
export const evokerModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'elementalist.familiars-prowess-strike',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    parameters: { baseAmount: 0.05, focusedAmount: 0.1 } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      hasTrait(context, "Familiar's Focus") ? parameters.focusedAmount : parameters.baseAmount,
    when: (context) =>
      context.config?.evokerElement === 'Air' && elementalistTimedBuffStacks(context, "familiar's-prowess", 1) > 0
  },
  {
    id: 'elementalist.familiars-prowess-condition',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    parameters: { baseAmount: 0.05, focusedAmount: 0.1 } as Readonly<Record<string, number>>,
    amount: (context, _target, parameters) =>
      hasTrait(context, "Familiar's Focus") ? parameters.focusedAmount : parameters.baseAmount,
    when: (context) =>
      context.config?.evokerElement === 'Fire' && elementalistTimedBuffStacks(context, "familiar's-prowess", 1) > 0
  },
  {
    id: 'elementalist.enhanced-potency-air',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.15,
    when: (context) =>
      context.config?.evokerElement === 'Air' &&
      hasTrait(context, 'Enhanced Potency') &&
      Boolean(context.query?.furyActiveAt(context.time, context.runtime, context.event))
  },
  {
    id: 'elementalist.zap',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.03,
    when: (context) =>
      context.config?.evokerElement === 'Air' && elementalistTimedBuffStacks(context, 'zap buff', 1) > 0
  }
]);

// ferocity and conditionDamage added here rather than as modifier rules because they must feed into crit-damage and condition scaling before those are computed
export function modifyEvokerAttributes(context: Gw2ModifierContext, attributes: SchedulerRecord): SchedulerRecord {
  const modified = { ...attributes };
  if (
    context.config?.evokerElement === 'Air' &&
    Boolean(context.query?.furyActiveAt(context.time, context.runtime, context.event))
  ) {
    modified.ferocity =
      Number(modified.ferocity || 0) + elementalistBalanceValue(context, PROFILE.enhancedPotency, 'attributeBonus', 75);
  }
  if (context.config?.evokerElement === 'Fire' && hasTrait(context, 'Enhanced Potency')) {
    // Fire Enhanced Potency scales condition damage per might stack
    modified.conditionDamage =
      Number(modified.conditionDamage || 0) +
      elementalistMightStacks(context) *
        elementalistBalanceValue(context, PROFILE.enhancedPotency, 'attributePerStack', 5);
  }
  return modified;
}
