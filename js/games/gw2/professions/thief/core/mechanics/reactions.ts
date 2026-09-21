import {
  onResolvedCriticalHit,
  onResolvedDamage,
  onConditionApplied,
  onBuffApplied
} from '#gw2/platform/profession-definition/mechanics.js';
import { handleThiefState } from '#gw2/professions/thief/family-state.js';
import {
  reactToThiefCoreBuff,
  reactToThiefCoreCondition,
  reactToThiefCoreDamage,
  thiefCoreCriticalReactions
} from '#gw2/professions/thief/core/traits/index.js';

// Keep phase wiring here while behavior stays with its state and trait owners.
export const thiefCoreEventHandlers = Object.freeze({
  'thief.state': handleThiefState
});

// Tag reactions here so module composition preserves their stage and registration order.
export const thiefCoreEventReactions = Object.freeze([
  onResolvedCriticalHit(thiefCoreCriticalReactions.unrelentingStrikes),
  onResolvedCriticalHit(thiefCoreCriticalReactions.noQuarter),
  onResolvedDamage({
    id: 'thief.core.damage',
    order: 30,
    handler: reactToThiefCoreDamage
  }),
  onConditionApplied({
    id: 'thief.core.condition',
    order: 0,
    handler: reactToThiefCoreCondition
  }),
  onBuffApplied({
    id: 'thief.core.buff',
    order: 30,
    handler: reactToThiefCoreBuff
  })
]);
