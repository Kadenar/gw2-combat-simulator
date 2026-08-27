import type { SchedulerRecord } from '../../../../platform/engine/types.js';
import { MODIFIER_TARGET } from '../../../../platform/gw2/combat/modifiers/rules.js';
import { hasTrait } from '../../../../platform/gw2/combat/state/traits.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '../../../../platform/gw2/combat/modifiers/types.js';
import { elementalistAttunements, elementalistTimedBuffStacks } from '../../core/modifiers.js';
import type { ElementalistRuntimeState } from '../../types.js';
import { elementalistBalanceValue } from '../../core/profiles.js';
import { WEAVER_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

function playerEvent(context: Gw2ModifierContext): boolean {
  return context.event?.actorType !== 'summon';
}

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
      playerEvent(context) &&
      hasTrait(context, 'Superior Elements') &&
      Boolean(context.query?.targetHasCondition('Weakness', context.time, context.runtime))
  }
]);

// Apply Elemental Polyphony's attribute bonuses from both current Weaver
// attunements without double-counting a repeated element.
function modifyWeaverAttributes(context: Gw2ModifierContext, attributes: SchedulerRecord): SchedulerRecord {
  if (!hasTrait(context, 'Elemental Polyphony')) return attributes;
  const modified = { ...attributes };
  const active = elementalistAttunements(context);
  const runtime = context.runtime?.profession as ElementalistRuntimeState | undefined;
  const secondary =
    runtime?.specialization.kind === 'Weaver'
      ? runtime.specialization.state.secondaryAttunement
      : context.config?.secondaryAttunement;
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
