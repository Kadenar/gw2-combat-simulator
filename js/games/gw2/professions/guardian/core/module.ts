import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createGuardianModuleData } from '#gw2/professions/guardian/data/module-data.js';
import {
  guardianCoreEventHandlers,
  guardianCoreEventReactions
} from '#gw2/professions/guardian/core/mechanics/reactions.js';
import { guardianCoreAttributeRules, guardianCoreCastRules } from '#gw2/professions/guardian/core/traits/modifiers.js';
import {
  GUARDIAN_CORE_EXTRA_SKILLS,
  GUARDIAN_CORE_SKILL_MECHANICS
} from '#gw2/professions/guardian/core/skills/index.js';
import { createGuardianCoreState, guardianEndurance } from '#gw2/professions/guardian/core/state.js';
import { projectGuardianPlanningState } from '#gw2/professions/guardian/family-state.js';
import { bindGuardianCoreUi } from '#gw2/professions/guardian/core/presentation.js';
import { GUARDIAN_CORE_BALANCE_PROFILES } from '#gw2/professions/guardian/core/profiles.js';
import { guardianCoreSkillHandlers } from '#gw2/professions/guardian/core/execution/index.js';
import { guardianCoreExecutionHooks } from '#gw2/professions/guardian/core/execution/hooks.js';

export const guardianCoreModule = defineNativeModule({
  id: 'Core',
  data: createGuardianModuleData('Core', {
    skillMechanics: GUARDIAN_CORE_SKILL_MECHANICS,
    extraSkills: GUARDIAN_CORE_EXTRA_SKILLS,
    balanceProfiles: GUARDIAN_CORE_BALANCE_PROFILES
  }),
  resources: { endurance: guardianEndurance },
  state: {
    scheduler: createGuardianCoreState,
    resolver: createGuardianCoreState,
    project: projectGuardianPlanningState
  },
  mechanics: {
    modifiers: guardianCoreAttributeRules,
    execution: {
      skillHandlers: guardianCoreSkillHandlers,
      castRules: guardianCoreCastRules,
      hooks: guardianCoreExecutionHooks
    },
    resolution: {
      reactions: guardianCoreEventReactions,
      hooks: {
        eventHandlers: guardianCoreEventHandlers
      }
    }
  },
  presentation: bindGuardianCoreUi
});
