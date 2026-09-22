import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createWarriorModuleData } from '#gw2/professions/warrior/data/module-data.js';
import {
  WARRIOR_CORE_SKILL_MECHANICS,
  WARRIOR_DODGE,
  WARRIOR_SWAP_WEAPONS,
  WARRIOR_WEAPON_STOW
} from '#gw2/professions/warrior/core/skills/index.js';
import { warriorCoreSkillHandlers } from '#gw2/professions/warrior/core/execution/index.js';
import { warriorCoreSkillMechanicHandlers } from '#gw2/professions/warrior/core/traits/index.js';
import { warriorCoreAttributeRules, warriorCoreCastRules } from '#gw2/professions/warrior/core/traits/modifiers.js';
import { createWarriorCoreState } from '#gw2/professions/warrior/core/state.js';
import { projectWarriorPlanningState } from '#gw2/professions/warrior/family-state.js';
import { bindWarriorCoreUi } from '#gw2/professions/warrior/core/presentation.js';
import { warriorCoreEventReactions } from '#gw2/professions/warrior/core/mechanics/reactions.js';
import { WARRIOR_CORE_BALANCE_PROFILES } from '#gw2/professions/warrior/core/profiles.js';
import { warriorCoreSchedulerHooks } from '#gw2/professions/warrior/core/execution/hooks.js';

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
    project: projectWarriorPlanningState
  },
  mechanics: {
    modifiers: warriorCoreAttributeRules,
    execution: {
      skillHandlers: warriorCoreSkillHandlers,
      castRules: warriorCoreCastRules,
      skillMechanicHandlers: warriorCoreSkillMechanicHandlers,
      hooks: warriorCoreSchedulerHooks
    },
    resolution: {
      reactions: warriorCoreEventReactions
    }
  },
  presentation: bindWarriorCoreUi
});
