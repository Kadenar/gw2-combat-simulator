import { defineNativeModule } from '../../../../integrations/patches/authoring/profession.js';
import { createRevenantModuleData } from '../data/catalog.js';
import { revenantCoreEventHandlers } from './mechanics/state-events.js';
import {
  revenantCoreAttributeRules,
  revenantCastRules,
  revenantSchedulerHooks,
  snapshotRevenantState
} from './traits/modifiers.js';
import { createRevenantCoreState } from './state.js';
import { projectRevenantEndState } from '../state/index.js';
import { revenantCoreUi } from './presentation.js';
import {
  REVENANT_CORE_BALANCE_PROFILES,
  REVENANT_CORE_BASE_SKILL_MECHANICS,
  REVENANT_CORE_EXTRA_SKILLS
} from './skills/index.js';
import { revenantCoreSkillHandlers } from './skills/handlers.js';
import type { RevenantSchedulerContext } from '../types.js';

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
