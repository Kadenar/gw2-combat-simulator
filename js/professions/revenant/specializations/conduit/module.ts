import { defineNativeModule } from '../../../../platform/gw2/native-profession.js';
import { createRevenantModuleData } from '../../catalog-data.js';
import { conduitSkillHandlers } from './handlers.js';
import { conduitEventHandlers } from './resolver.js';
import { conduitAttributeRules, conduitCastRules, conduitSchedulerHooks } from './rules.js';
import { conduitState } from './state.js';
import { conduitUi } from './ui.js';
import { CONDUIT_BASE_SKILL_MECHANICS, CONDUIT_BALANCE_PROFILES } from './skills.js';

export const conduitModule = defineNativeModule({
  id: 'Conduit',
  data: createRevenantModuleData('Conduit', {
    skillMechanics: CONDUIT_BASE_SKILL_MECHANICS,
    balanceProfiles: CONDUIT_BALANCE_PROFILES,
    handlers: conduitSkillHandlers
  }),
  // Scheduler and resolver each get their own independent copy of ConduitState so they never share mutable affinity.
  state: { scheduler: conduitState.create, resolver: conduitState.create },
  mechanics: {
    modifiers: conduitAttributeRules,
    castRules: conduitCastRules,
    schedulerHooks: conduitSchedulerHooks,
    resolverHooks: {
      eventHandlers: conduitEventHandlers
    }
  },
  presentation: conduitUi
});
