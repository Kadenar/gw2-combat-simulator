import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { onBuffApplied, onResolvedDamage } from '#gw2/platform/profession-definition/mechanics.js';
import { createWarriorModuleData } from '#gw2/professions/warrior/catalog/module-data.js';
import {
  WARRIOR_CORE_SKILL_MECHANICS,
  WARRIOR_DODGE,
  WARRIOR_SWAP_WEAPONS,
  WARRIOR_WEAPON_STOW
} from '#gw2/professions/warrior/core/skills/index.js';
import { warriorCoreSkillHandlers } from '#gw2/professions/warrior/core/execution/index.js';
import {
  warriorCoreSkillMechanicHandlers,
  advanceWarriorTraits,
  applyWarriorWeaponSwapTraits,
  beginWarriorSkill,
  completeWarriorSkill,
  handleWarriorArmsCriticalTask,
  initializeWarriorTraits,
  observeWarriorEvent
} from '#gw2/professions/warrior/core/traits/index.js';
import { warriorCoreAttributeRules, warriorCoreCastRules } from '#gw2/professions/warrior/core/traits/modifiers.js';
import { createWarriorCoreState } from '#gw2/professions/warrior/core/state.js';
import { projectWarriorEndState, snapshotWarriorState } from '#gw2/professions/warrior/state.js';
import { bindWarriorCoreUi } from '#gw2/professions/warrior/core/presentation.js';
import type { WarriorSchedulerContext } from '#gw2/professions/warrior/types.js';
import {
  warriorCoreEventHandlers,
  warriorCoreEventReactions
} from '#gw2/professions/warrior/core/mechanics/reactions.js';
import { WARRIOR_CORE_BALANCE_PROFILES } from '#gw2/professions/warrior/core/profiles.js';
import { handleWarriorAdrenalineTask } from '#gw2/professions/warrior/resources.js';
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
      advanceWarriorTraits(context, target);
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
    'warrior.adrenaline-hit': handleWarriorAdrenalineTask,
    'warrior.arms-critical': handleWarriorArmsCriticalTask
  })
});

export const warriorCoreModule = defineNativeModule({
  id: 'Core',
  data: createWarriorModuleData('Core', {
    skillMechanics: WARRIOR_CORE_SKILL_MECHANICS,
    balanceProfiles: WARRIOR_CORE_BALANCE_PROFILES,
    extraSkills: [WARRIOR_DODGE, WARRIOR_SWAP_WEAPONS, WARRIOR_WEAPON_STOW]
  }),
  state: {
    scheduler: createWarriorCoreState,
    resolver: createWarriorCoreState,
    project: projectWarriorEndState
  },
  mechanics: {
    modifiers: warriorCoreAttributeRules,
    execution: {
      skillHandlers: warriorCoreSkillHandlers,
      castRules: warriorCoreCastRules,
      skillMechanicHandlers: warriorCoreSkillMechanicHandlers,
      hooks: {
        ...warriorCoreSchedulerHooks,
        snapshot: (context: WarriorSchedulerContext) =>
          snapshotWarriorState(context.state.profession, context.catalog.skillsById)
      }
    },
    resolution: {
      hooks: {
        eventHandlers: warriorCoreEventHandlers
      },
      reactions: [
        ...warriorCoreEventReactions.damage.map(onResolvedDamage),
        ...warriorCoreEventReactions.buff.map(onBuffApplied)
      ]
    }
  },
  presentation: bindWarriorCoreUi
});
