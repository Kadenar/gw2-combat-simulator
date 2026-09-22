import { empowerAllies } from '#gw2/professions/warrior/core/traits/tactics.js';
import {
  signetOfRage,
  applyWarriorWeaponSwapTraits,
  beginWarriorSkill,
  completeWarriorSkill,
  warriorArmsReaction,
  warriorAdrenalineReaction,
  initializeWarriorTraits,
  observeWarriorEvent
} from '#gw2/professions/warrior/core/traits/index.js';
import type { WarriorSchedulerContext } from '#gw2/professions/warrior/types.js';
import { advanceWarriorResources } from '#gw2/professions/warrior/core/mechanics/adrenaline-and-endurance.js';

/** Registers Core Warrior resources, weapons, traits, and tasks in scheduler order. */
export const warriorCoreSchedulerHooks = Object.freeze({
  initialize: initializeWarriorTraits,
  onCastStart: beginWarriorSkill,
  // Core weapon-swap traits extend the shared transition through one hook.
  onWeaponSwap: applyWarriorWeaponSwapTraits,
  advance: {
    id: 'warrior.core-resources-and-traits',
    order: 10,
    handler: (context: WarriorSchedulerContext, target: number) => {
      advanceWarriorResources(context, target);
    }
  },
  onEventScheduled: {
    id: 'warrior.adrenaline',
    order: 10,
    handler: observeWarriorEvent
  },
  onCastComplete: {
    id: 'warrior.core-skill-completion',
    order: 10,
    handler: completeWarriorSkill
  },
  taskHandlers: Object.freeze({
    ...signetOfRage.taskHandlers,
    ...empowerAllies.taskHandlers,
    ...warriorAdrenalineReaction.taskHandlers,
    ...warriorArmsReaction.taskHandlers
  })
});
