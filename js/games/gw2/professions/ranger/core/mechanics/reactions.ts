import {
  handleRangerBeastSkillUsed,
  handleRangerBloodThirst,
  handleRangerPetSwapped,
  handleRangerPoisonousStrikes,
  handleRangerSharpeningStone,
  handleRangerWinterBiteReady
} from '#gw2/professions/ranger/core/mechanics/event-handlers.js';
import {
  rangerCoreProfiledCriticalReaction,
  reactToRangerCoreBuff,
  reactToRangerCoreControl,
  reactToRangerCoreDamage
} from '#gw2/professions/ranger/core/traits/index.js';

export { rangerCoreCriticalReactions } from '#gw2/professions/ranger/core/traits/index.js';

export const rangerCoreEventHandlers = Object.freeze({
  'ranger.blood-thirst': handleRangerBloodThirst,
  'ranger.winter-bite-ready': handleRangerWinterBiteReady,
  'ranger.beast-skill-used': handleRangerBeastSkillUsed,
  'ranger.poisonous-strikes': handleRangerPoisonousStrikes,
  'ranger.sharpening-stone': handleRangerSharpeningStone,
  'ranger.pet-swapped': handleRangerPetSwapped
});

export const rangerCoreEventReactions = Object.freeze({
  critical: Object.freeze([rangerCoreProfiledCriticalReaction]),
  damage: Object.freeze([
    {
      id: 'ranger.core-damage',
      order: 10,
      handler: reactToRangerCoreDamage
    }
  ]),
  control: Object.freeze([
    {
      id: 'ranger.core-control',
      order: 10,
      handler: reactToRangerCoreControl
    }
  ]),
  buff: Object.freeze([
    {
      id: 'ranger.core-buff',
      order: 10,
      handler: reactToRangerCoreBuff
    }
  ])
});
