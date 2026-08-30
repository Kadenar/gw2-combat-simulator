import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { createRevenantModuleData } from '../../data/catalog.js';
import { heraldSkillHandlers } from './handlers.js';
import { heraldAttributeRules, heraldCastRules, heraldSchedulerHooks } from './rules.js';
import { heraldState } from './state.js';
import { heraldUi } from './presentation.js';
import { HERALD_BALANCE_PROFILES, HERALD_BASE_SKILL_MECHANICS } from './skills.js';

export const heraldModule = defineNativeModule({
  id: 'Herald',
  data: createRevenantModuleData('Herald', {
    skillMechanics: HERALD_BASE_SKILL_MECHANICS,
    balanceProfiles: HERALD_BALANCE_PROFILES,
    handlers: heraldSkillHandlers
  }),
  // Scheduler and resolver share the same (empty) state factory; Herald needs no resolver-private fields.
  state: { scheduler: heraldState.create, resolver: heraldState.create },
  mechanics: {
    modifiers: heraldAttributeRules,
    // Herald owns facet activation/consume availability while Core supplies only the shared upkeep resource gate.
    castRules: heraldCastRules,
    schedulerHooks: heraldSchedulerHooks
  },
  presentation: heraldUi
});
