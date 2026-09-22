import { onResolvedDamage, onBuffApplied } from '#gw2/platform/profession-definition/mechanics.js';
import { reactToWarriorBuff, reactToWarriorDamage } from '#gw2/professions/warrior/core/traits/index.js';

// Tag reactions here so module composition preserves their stage and registration order.
export const warriorCoreEventReactions = Object.freeze([
  onResolvedDamage({
    id: 'warrior.core-damage',
    order: 0,
    handler: reactToWarriorDamage
  }),
  onBuffApplied({
    id: 'warrior.peak-performance',
    order: 0,
    handler: reactToWarriorBuff
  })
]);
