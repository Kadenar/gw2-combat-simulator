import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { createRevenantModuleData } from '../../data/catalog.js';
import { heraldSkillHandlers } from './skills/handlers.js';
import { heraldAttributeRules, heraldCastRules, heraldSchedulerHooks } from './mechanics/facet-rules.js';
import { heraldState } from './state.js';
import { heraldUi } from './presentation.js';
import { HERALD_BALANCE_PROFILES, HERALD_BASE_SKILL_MECHANICS } from './skills/index.js';

export const heraldModule = defineNativeModule({
  id: 'Herald',
  data: createRevenantModuleData('Herald', {
    skillMechanics: HERALD_BASE_SKILL_MECHANICS,
    balanceProfiles: HERALD_BALANCE_PROFILES
  }),
  // Scheduler and resolver share the same (empty) state factory; Herald needs no resolver-private fields.
  state: { scheduler: heraldState.create, resolver: heraldState.create },
  mechanics: {
    modifiers: heraldAttributeRules,
    execution: {
      skillHandlers: heraldSkillHandlers,
      // Herald owns facet activation/consume availability while Core supplies only the shared upkeep resource gate.
      castRules: heraldCastRules,
      hooks: heraldSchedulerHooks
    }
  },
  presentation: heraldUi
});
