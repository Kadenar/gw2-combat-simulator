import { handleWarriorBoonRemoval } from './events.js';
import { reactToWarriorBuff, reactToWarriorDamage } from './traits.js';

export { handleWarriorBoonRemoval } from './events.js';
export { warriorBoonRemovalCounts } from './shared.js';
export { reactToWarriorBuff, reactToWarriorDamage } from './traits.js';

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
