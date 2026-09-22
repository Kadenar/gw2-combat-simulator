import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createEngineerModuleData } from '#gw2/professions/engineer/data/module-data.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { engineerCoreSkillHandlers } from '#gw2/professions/engineer/core/execution/index.js';
import { engineerCoreAttributeRules, engineerCoreCastRules } from '#gw2/professions/engineer/core/traits/modifiers.js';
import {
  engineerCoreResolverEventHandlers,
  engineerCoreResolverEventReactions
} from '#gw2/professions/engineer/core/mechanics/reactions.js';
import {
  ENGINEER_CORE_EXTRA_SKILLS,
  ENGINEER_CORE_SKILL_MECHANICS
} from '#gw2/professions/engineer/core/skills/index.js';
import { createEngineerCoreState } from '#gw2/professions/engineer/core/state.js';
import { projectEngineerPlanningState } from '#gw2/professions/engineer/family-state.js';
import { ENGINEER_CORE_BALANCE_PROFILES } from '#gw2/professions/engineer/core/profiles.js';
import { bindEngineerCoreUi } from '#gw2/professions/engineer/core/presentation.js';
import { engineerCoreSchedulerHooks } from '#gw2/professions/engineer/core/execution/hooks.js';

export const engineerCoreModule = defineNativeModule({
  id: 'Core',
  data: createEngineerModuleData('Core', {
    skillMechanics: ENGINEER_CORE_SKILL_MECHANICS,
    balanceProfiles: ENGINEER_CORE_BALANCE_PROFILES,
    extraSkills: ENGINEER_CORE_EXTRA_SKILLS,
    // RIFLE_BURST_GRENADE is a sub-packet of Rifle Burst, not a standalone chain member
    autoattackChains: { excludeSkillIds: [ID.RIFLE_BURST_GRENADE] }
  }),
  state: {
    // scheduler and resolver each need an independent initial state instance
    scheduler: createEngineerCoreState,
    resolver: createEngineerCoreState,
    project: projectEngineerPlanningState
  },
  mechanics: {
    modifiers: engineerCoreAttributeRules,
    execution: {
      skillHandlers: engineerCoreSkillHandlers,
      castRules: engineerCoreCastRules,
      hooks: engineerCoreSchedulerHooks
    },
    resolution: {
      reactions: engineerCoreResolverEventReactions,
      hooks: {
        eventHandlers: engineerCoreResolverEventHandlers
      }
    }
  },
  presentation: bindEngineerCoreUi
});
