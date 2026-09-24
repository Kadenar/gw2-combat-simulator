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

import { buildingMomentumGrant } from '#gw2/professions/warrior/core/traits/strength.js';
import { advanceProfessionEndurance } from '#gw2/platform/combat/resources/endurance-policy.js';

/** Registers Core Warrior resources, weapons, traits, and tasks in scheduler order. */
export const warriorCoreSchedulerHooks = Object.freeze({
  initialize: initializeWarriorTraits,
  onCastStart: beginWarriorSkill,
  // Core weapon-swap traits extend the shared transition through one hook.
  onWeaponSwap: applyWarriorWeaponSwapTraits,
  advance: {
    id: 'warrior.core-resources-and-traits',
    order: 10,
    handler: advanceProfessionEndurance
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
    ...buildingMomentumGrant.taskHandlers,
    ...signetOfRage.taskHandlers,
    ...empowerAllies.taskHandlers,
    ...warriorAdrenalineReaction.taskHandlers,
    ...warriorArmsReaction.taskHandlers
  })
});
