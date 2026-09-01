import { handleThiefState } from '#gw2/content/professions/thief/state.js';
import {
  reactToThiefCoreBuff,
  reactToThiefCoreCondition,
  reactToThiefCoreDamage,
  thiefCoreCriticalReactions
} from '#gw2/content/professions/thief/core/traits/index.js';

// Keep phase wiring here while behavior stays with its state and trait owners.
export const thiefCoreEventHandlers = Object.freeze({
  'thief.state': handleThiefState
});

export const thiefCoreEventReactions = Object.freeze({
  critical: Object.freeze([thiefCoreCriticalReactions.unrelentingStrikes, thiefCoreCriticalReactions.noQuarter]),
  damage: Object.freeze([
    {
      id: 'thief.core.damage',
      order: 30,
      handler: reactToThiefCoreDamage
    }
  ]),
  condition: Object.freeze([
    {
      id: 'thief.core.condition',
      order: 0,
      handler: reactToThiefCoreCondition
    }
  ]),
  buff: Object.freeze([
    {
      id: 'thief.core.buff',
      order: 30,
      handler: reactToThiefCoreBuff
    }
  ])
});
