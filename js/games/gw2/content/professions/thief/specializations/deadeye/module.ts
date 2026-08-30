import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { createThiefModuleData } from '../../data/catalog.js';
import { deadeyeSkillHandlers } from './handlers.js';
import { deadeyeAttributeRules, deadeyeCastRules, deadeyeSchedulerHooks } from './rules.js';
import { deadeyeState } from './state.js';
import { deadeyeUi } from './presentation.js';
import { DEADEYE_SKILL_MECHANICS } from './skills.js';
import { DEADEYE_BALANCE_PROFILES } from './profiles.js';

export const deadeyeModule = defineNativeModule({
  id: 'Deadeye',
  data: createThiefModuleData('Deadeye', {
    skillMechanics: DEADEYE_SKILL_MECHANICS,
    balanceProfiles: DEADEYE_BALANCE_PROFILES,
    handlers: deadeyeSkillHandlers
  }),
  // Same factory for both scheduler and resolver; Deadeye state is fully reconstructed from scratch for each phase
  state: { scheduler: deadeyeState.create, resolver: deadeyeState.create },
  mechanics: {
    modifiers: deadeyeAttributeRules,
    castRules: deadeyeCastRules,
    schedulerHooks: deadeyeSchedulerHooks
  },
  presentation: deadeyeUi
});
