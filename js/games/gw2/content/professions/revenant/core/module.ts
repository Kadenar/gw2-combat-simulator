import { defineNativeModule } from '../../../../integrations/patches/authoring/profession.js';
import { createRevenantModuleData } from '../data/catalog.js';
import { revenantCoreEventHandlers } from './resolver.js';
import {
  revenantCoreAttributeRules,
  revenantCastRules,
  revenantSchedulerHooks,
  snapshotRevenantState
} from './rules.js';
import { createRevenantCoreState } from './state.js';
import { projectRevenantEndState } from '../state/index.js';
import { revenantCoreUi } from './presentation.js';
import {
  REVENANT_CORE_BALANCE_PROFILES,
  REVENANT_CORE_BASE_SKILL_MECHANICS,
  REVENANT_CORE_EXTRA_SKILLS
} from './skills.js';
import { revenantCoreSkillHandlers } from './handlers.js';
import type { RevenantSchedulerContext } from '../types.js';

export const revenantCoreModule = defineNativeModule({
  id: 'Core',
  data: createRevenantModuleData('Core', {
    skillMechanics: REVENANT_CORE_BASE_SKILL_MECHANICS,
    extraSkills: REVENANT_CORE_EXTRA_SKILLS,
    balanceProfiles: REVENANT_CORE_BALANCE_PROFILES,
    handlers: revenantCoreSkillHandlers
  }),
  state: {
    scheduler: createRevenantCoreState,
    resolver: createRevenantCoreState,
    project: projectRevenantEndState
  },
  mechanics: {
    modifiers: revenantCoreAttributeRules,
    castRules: revenantCastRules,
    schedulerHooks: {
      ...revenantSchedulerHooks,
      snapshot: (context: RevenantSchedulerContext) => snapshotRevenantState(context.state.profession)
    },
    resolverHooks: {
      eventHandlers: revenantCoreEventHandlers
    }
  },
  presentation: revenantCoreUi
});
