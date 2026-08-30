import {
  handleRangerBeastSkillUsed,
  handleRangerBloodThirst,
  handleRangerPetSwapped,
  handleRangerPoisonousStrikes,
  handleRangerSharpeningStone,
  handleRangerWinterBiteReady
} from './event-handlers.js';
import {
  rangerCoreCriticalReactions,
  rangerCoreProfiledCriticalReaction,
  reactToRangerCoreBuff,
  reactToRangerCoreControl,
  reactToRangerCoreDamage
} from '../traits/index.js';

export { rangerCoreCriticalReactions } from '../traits/index.js';

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
