import { handleWarriorBoonRemoval } from './event-handlers.js';
import { reactToWarriorBuff, reactToWarriorDamage } from '../traits/index.js';

export { handleWarriorBoonRemoval } from './event-handlers.js';
export { warriorBoonRemovalCounts } from './resolution-helpers.js';
export { reactToWarriorBuff, reactToWarriorDamage } from '../traits/index.js';

export const warriorCoreEventHandlers = Object.freeze({
  'warrior.boon-removal': handleWarriorBoonRemoval
});

export const warriorCoreEventReactions = Object.freeze({
  damage: Object.freeze([
    {
      id: 'warrior.core-damage',
      order: 0,
      handler: reactToWarriorDamage
    }
  ]),
  buff: Object.freeze([
    {
      id: 'warrior.peak-performance',
      order: 0,
      handler: reactToWarriorBuff
    }
  ])
});
