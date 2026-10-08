import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import { triggerShatteringStone } from '#gw2/professions/elementalist/core/skills/weapons/pistol.js';
import { applyStrengthOfStone } from '#gw2/professions/elementalist/core/traits/earth/index.js';
import {
  applyPersistingFlamesCondition,
  applyPersistingFlamesDamage
} from '#gw2/professions/elementalist/core/traits/fire/persisting-flames.js';
import type { ElementalistResolverContext } from '#gw2/professions/elementalist/types.js';

export {
  activeElementalistBuffs,
  refreshElementalistBuffs
} from '#gw2/professions/elementalist/core/mechanics/resolution-helpers.js';

/** Applies strike reactions in impact order, regardless of when their packets were scheduled. */
export function applyElementalistResolvedDamage(context: ElementalistResolverContext, event: Gw2ResolverEvent): void {
  applyPersistingFlamesDamage(context, event);
  triggerShatteringStone(context, event);
}

/** Classifies conditions and preserves Strength of Stone before Persisting Flames. */
export function applyElementalistResolvedCondition(
  context: ElementalistResolverContext,
  event: Gw2ResolverEvent
): void {
  if (event.condition === 'Immobilized' && (context.combatStartTime == null || event.at >= context.combatStartTime)) {
    applyStrengthOfStone(context, event);
  }

  applyPersistingFlamesCondition(context, event);
}
