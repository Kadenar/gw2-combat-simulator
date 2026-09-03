import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createRevenantModuleData } from '#gw2/professions/revenant/catalog/module-data.js';
import { revenantCoreEventHandlers } from '#gw2/professions/revenant/core/mechanics/state-events.js';
import {
  revenantCoreAttributeRules,
  revenantCastRules,
  revenantSchedulerHooks,
  snapshotRevenantState
} from '#gw2/professions/revenant/core/traits/modifiers.js';
import { createRevenantCoreState } from '#gw2/professions/revenant/core/state.js';
import { projectRevenantEndState } from '#gw2/professions/revenant/state.js';
import { revenantCoreUi } from '#gw2/professions/revenant/core/presentation.js';
import {
  REVENANT_CORE_BASE_SKILL_MECHANICS,
  REVENANT_CORE_EXTRA_SKILLS
} from '#gw2/professions/revenant/core/skills/index.js';
import { REVENANT_CORE_BALANCE_PROFILES } from '#gw2/professions/revenant/core/profiles.js';
import { revenantCoreSkillHandlers } from '#gw2/professions/revenant/core/execution/index.js';
import type { RevenantSchedulerContext } from '#gw2/professions/revenant/types.js';

export const revenantCoreModule = defineNativeModule({
  id: 'Core',
  data: createRevenantModuleData('Core', {
    skillMechanics: REVENANT_CORE_BASE_SKILL_MECHANICS,
    extraSkills: REVENANT_CORE_EXTRA_SKILLS,
    balanceProfiles: REVENANT_CORE_BALANCE_PROFILES
  }),
  state: {
    scheduler: createRevenantCoreState,
    resolver: createRevenantCoreState,
    project: projectRevenantEndState
  },
  mechanics: {
    modifiers: revenantCoreAttributeRules,
    execution: {
      skillHandlers: revenantCoreSkillHandlers,
      castRules: revenantCastRules,
      hooks: {
        ...revenantSchedulerHooks,
        snapshot: (context: RevenantSchedulerContext) => snapshotRevenantState(context.state.profession)
      }
    },
    resolution: {
      hooks: {
        eventHandlers: revenantCoreEventHandlers
      }
    }
  },
  presentation: revenantCoreUi
});
