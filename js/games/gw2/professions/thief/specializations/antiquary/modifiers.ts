import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import type { AntiquaryState } from '#gw2/professions/thief/specializations/antiquary/state.js';

import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { thiefRuntimeSpecializationState } from '#gw2/professions/thief/core/state-queries.js';

export const antiquaryModifiers = Object.freeze<readonly Gw2ModifierRule[]>([
  {
    order: 403,
    id: 'thief.kryptis-turret-damage',
    target: MODIFIER_TARGET.STRIKE_DAMAGE,
    operation: 'multiply',
    factor: 1.15,
    when: (context) =>
      isGw2PlayerModifierOwnedEvent(context.event) &&
      (thiefRuntimeSpecializationState<AntiquaryState>(context, 'Antiquary').kryptisDamageUntil || 0) > context.time
  }
]);
