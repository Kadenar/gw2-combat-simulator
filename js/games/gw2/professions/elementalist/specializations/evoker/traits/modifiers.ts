/**
 * Evoker damage and attribute modifiers.
 *
 * Declarative rules evaluated per damage event, plus an attribute pass for the
 * bonuses that must land on ferocity and condition damage before those
 * attributes feed into scaling.
 */
import { balanceProfileValueFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import type { SchedulerRecord } from '#gw2/platform/engine/types.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers/rules.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';
import {
  elementalistMightStacks,
  elementalistTimedBuffStacks
} from '#gw2/professions/elementalist/core/traits/modifiers.js';

import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';

/**
 * Per-event damage rules for the Evoker traits. Each rule's `when` predicate
 * checks the selected element plus its trait or buff preconditions, so builds
 * that lack them contribute nothing.
 */
// Familiar's Prowess buffs strike for Air element, condition for Fire — damage type bonus is element-gated
export const evokerModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'elementalist.fiery-might',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.05,
    when: (context) => hasTrait(context, 'Fiery Might') && targetConditionActive(context, 'Burning')
  },
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

/**
 * Applies Enhanced Potency's attribute bonuses: ferocity while Fury is up on an
 * Air Evoker, and might-scaled condition damage on a Fire Evoker.
 */
// ferocity and conditionDamage added here rather than as modifier rules because they must feed into crit-damage and condition scaling before those are computed
export function modifyEvokerAttributes(context: Gw2ModifierContext, attributes: SchedulerRecord): SchedulerRecord {
  const modified = { ...attributes };
  if (
    context.config?.evokerElement === 'Air' &&
    Boolean(context.query?.furyActiveAt(context.time, context.runtime, context.event))
  ) {
    modified.ferocity =
      Number(modified.ferocity || 0) +
      balanceProfileValueFromContext(context, PROFILE.enhancedPotency, 'attributeBonus', 75);
  }

  if (context.config?.evokerElement === 'Fire' && hasTrait(context, 'Enhanced Potency')) {
    // Fire Enhanced Potency scales condition damage per might stack
    modified.conditionDamage =
      Number(modified.conditionDamage || 0) +
      elementalistMightStacks(context) *
        balanceProfileValueFromContext(context, PROFILE.enhancedPotency, 'attributePerStack', 5);
  }

  return modified;
}
