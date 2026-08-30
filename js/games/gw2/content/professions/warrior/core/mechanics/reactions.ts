import { handleWarriorBoonRemoval } from '#gw2/content/professions/warrior/core/mechanics/event-handlers.js';
import { reactToWarriorBuff, reactToWarriorDamage } from '#gw2/content/professions/warrior/core/traits/index.js';

export { handleWarriorBoonRemoval } from '#gw2/content/professions/warrior/core/mechanics/event-handlers.js';
export { warriorBoonRemovalCounts } from '#gw2/content/professions/warrior/core/mechanics/resolution-helpers.js';
export { reactToWarriorBuff, reactToWarriorDamage } from '#gw2/content/professions/warrior/core/traits/index.js';

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
