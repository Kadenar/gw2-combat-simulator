import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { createRevenantModuleData } from '../../data/catalog.js';
import { conduitSkillHandlers } from './skills/handlers.js';
import { conduitAttributeRules, conduitCastRules, conduitSchedulerHooks } from './mechanics/affinity-rules.js';
import { conduitState } from './state.js';
import { conduitUi } from './presentation.js';
import { CONDUIT_BASE_SKILL_MECHANICS, CONDUIT_BALANCE_PROFILES } from './skills/index.js';

export const conduitModule = defineNativeModule({
  id: 'Conduit',
  data: createRevenantModuleData('Conduit', {
    skillMechanics: CONDUIT_BASE_SKILL_MECHANICS,
    balanceProfiles: CONDUIT_BALANCE_PROFILES
  }),
  // Scheduler and resolver each get their own independent copy of ConduitState so they never share mutable affinity.
  state: { scheduler: conduitState.create, resolver: conduitState.create },
  mechanics: {
    modifiers: conduitAttributeRules,
    execution: {
      skillHandlers: conduitSkillHandlers,
      castRules: conduitCastRules,
      hooks: conduitSchedulerHooks
    }
  },
  presentation: conduitUi
});
