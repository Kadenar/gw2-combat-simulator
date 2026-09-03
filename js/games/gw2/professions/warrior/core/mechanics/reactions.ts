import { handleWarriorBoonRemoval } from '#gw2/professions/warrior/core/mechanics/event-handlers.js';
import { reactToWarriorBuff, reactToWarriorDamage } from '#gw2/professions/warrior/core/traits/index.js';

// Keep phase wiring here while behavior stays with its mechanic and trait owners.
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
