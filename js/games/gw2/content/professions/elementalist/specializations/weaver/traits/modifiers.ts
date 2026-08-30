import type { SchedulerRecord } from '../../../../../../platform/engine/types.js';
import { readProfessionSpecializationState } from '../../../../../../platform/engine/profession/state.js';
import { MODIFIER_TARGET } from '../../../../../../platform/combat/modifiers/rules.js';
import { isGw2PlayerModifierEligibleEvent } from '../../../../../../platform/combat/state/event-ownership.js';
import { hasTrait } from '../../../../../../platform/combat/state/traits.js';
import { targetConditionActive } from '../../../../../../platform/combat/query/runtime-query.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '../../../../../../platform/combat/modifiers/types.js';
import { elementalistAttunements, elementalistTimedBuffStacks } from '../../../core/traits/modifiers.js';
import { elementalistBalanceValue } from '../../../core/profiles.js';
import { WEAVER_BALANCE_PROFILE_IDS as PROFILE } from '../profiles.js';

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
  },
  {
    id: 'elementalist.elements-of-rage-strike',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.15,
    when: (context) =>
      hasTrait(context, 'Elements of Rage') && elementalistTimedBuffStacks(context, 'elements of rage', 1) > 0
  },
  {
    id: 'elementalist.elements-of-rage-condition',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    amount: 0.1,
    when: (context) =>
      hasTrait(context, 'Elements of Rage') && elementalistTimedBuffStacks(context, 'elements of rage', 1) > 0
  },
  {
    id: 'elementalist.superior-elements',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: 0.2,
    when: (context) =>
      isGw2PlayerModifierEligibleEvent(context.event) &&
      hasTrait(context, 'Superior Elements') &&
      targetConditionActive(context, 'Weakness')
  }
]);

// Apply Elemental Polyphony's attribute bonuses from both current Weaver
// attunements without double-counting a repeated element.
function modifyWeaverAttributes(context: Gw2ModifierContext, attributes: SchedulerRecord): SchedulerRecord {
  if (!hasTrait(context, 'Elemental Polyphony')) return attributes;
  const modified = { ...attributes };
  const active = elementalistAttunements(context);
  const secondary =
    readProfessionSpecializationState<{ secondaryAttunement?: string }>(context.runtime?.profession, 'Weaver')
      ?.secondaryAttunement ?? context.config?.secondaryAttunement;
  if (typeof secondary === 'string') active.add(secondary);

  const attributeBonus = elementalistBalanceValue(context, PROFILE.elementalPolyphony, 'attributeBonus', 200);
  if (active.has('Fire')) {
    modified.power = Number(modified.power || 0) + attributeBonus;
  }

  if (active.has('Air')) {
    modified.ferocity = Number(modified.ferocity || 0) + attributeBonus;
  }

  if (active.has('Earth')) {
    modified.conditionDamage = Number(modified.conditionDamage || 0) + attributeBonus;
  }

  return modified;
}

export { modifyWeaverAttributes };
