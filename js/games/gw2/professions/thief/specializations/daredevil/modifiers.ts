import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';

import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { thiefRuntimeState, thiefRuntimeSpecializationState } from '#gw2/professions/thief/core/modifiers.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import type { DaredevilState } from '#gw2/professions/thief/specializations/daredevil/state.js';
import { DAREDEVIL_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/daredevil/profiles.js';

export const daredevilModifiers: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'thief.weakening-strikes',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.1,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.WEAKENING_STRIKES) &&
      targetConditionActive(context, 'Weakness')
  },
  {
    id: 'thief.havoc-specialist',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.15,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.HAVOC_SPECIALIST) &&
      // Trait activates whenever endurance is not at maximum — any spent dodge qualifies
      Number(thiefRuntimeState(context).endurance || 0) <
        balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.resources), 'maximumStacks')
  },
  {
    id: 'thief.bounding-dodger',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'damage-additive',
    amount: 0.15,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.BOUNDING_DODGER) &&
      Number(thiefRuntimeSpecializationState<DaredevilState>(context, 'Daredevil').boundingDamageUntil || 0) >
        context.time
  },
  {
    id: 'thief.lotus-training',
    target: MODIFIER_TARGET.CONDITION_DAMAGE,
    operation: 'damage-additive',
    amount: 0.15,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      hasTrait(context, TRAIT.LOTUS_TRAINING) &&
      Number(thiefRuntimeSpecializationState<DaredevilState>(context, 'Daredevil').lotusConditionDamageUntil || 0) >
        context.time
  }
]);
