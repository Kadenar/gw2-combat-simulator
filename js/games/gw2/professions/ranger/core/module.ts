import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createRangerModuleData } from '#gw2/professions/ranger/data/module-data.js';
import {
  rangerCoreSkillHandlers,
  rangerCoreSkillMechanicHandlers
} from '#gw2/professions/ranger/core/execution/index.js';
import { rangerCoreAttributeRules, rangerCoreCastRules } from '#gw2/professions/ranger/core/traits/modifiers.js';
import {
  RANGER_CORE_BASE_SKILL_MECHANICS,
  RANGER_CORE_EXTRA_SKILLS
} from '#gw2/professions/ranger/core/skills/index.js';
import { projectRangerPlanningState } from '#gw2/professions/ranger/family-state.js';
import { createRangerCoreState } from '#gw2/professions/ranger/core/state.js';
import { bindRangerCoreUi } from '#gw2/professions/ranger/core/presentation.js';
import { rangerCoreEventHandlers, rangerCoreEventReactions } from '#gw2/professions/ranger/core/mechanics/reactions.js';
import { RANGER_CORE_BALANCE_PROFILES } from '#gw2/professions/ranger/core/profiles.js';
import { rangerCoreExecutionHooks } from '#gw2/professions/ranger/core/execution/hooks.js';

export const rangerCoreModule = defineNativeModule({
  id: 'Core',
  data: createRangerModuleData('Core', {
    skillMechanics: RANGER_CORE_BASE_SKILL_MECHANICS,
    balanceProfiles: RANGER_CORE_BALANCE_PROFILES,
    extraSkills: RANGER_CORE_EXTRA_SKILLS
  }),
  state: {
    scheduler: createRangerCoreState,
    resolver: createRangerCoreState,
    project: projectRangerPlanningState
  },
  mechanics: {
    modifiers: rangerCoreAttributeRules,
    execution: {
      skillHandlers: rangerCoreSkillHandlers,
      castRules: rangerCoreCastRules,
      skillMechanicHandlers: rangerCoreSkillMechanicHandlers,
      hooks: rangerCoreExecutionHooks
    },
    resolution: {
      hooks: { eventHandlers: rangerCoreEventHandlers },
      reactions: rangerCoreEventReactions
    }
  },
  presentation: bindRangerCoreUi
});
