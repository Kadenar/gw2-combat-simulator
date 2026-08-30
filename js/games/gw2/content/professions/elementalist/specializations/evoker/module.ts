import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { createElementalistModuleData } from '../../data/catalog.js';
import { evokerAttributeRules, evokerCastRules, evokerSchedulerHooks } from './rules.js';
import { createEvokerState } from './state.js';
import { evokerUi } from './presentation.js';
import { EVOKER_SKILL_MECHANICS } from './skills.js';
import { evokerSkillHandlers } from './handlers.js';
import { EVOKER_BALANCE_PROFILES } from './profiles.js';

export const evokerModule = defineNativeModule({
  id: 'Evoker',
  data: createElementalistModuleData('Evoker', {
    skillMechanics: EVOKER_SKILL_MECHANICS,
    balanceProfiles: EVOKER_BALANCE_PROFILES,
    handlers: evokerSkillHandlers
  }),
  state: { scheduler: createEvokerState, resolver: createEvokerState },
  mechanics: {
    modifiers: evokerAttributeRules,
    castRules: evokerCastRules,
    schedulerHooks: evokerSchedulerHooks
  },
  presentation: evokerUi
});
