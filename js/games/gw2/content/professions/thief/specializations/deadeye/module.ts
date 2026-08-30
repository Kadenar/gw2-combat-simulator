import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { createThiefModuleData } from '../../data/catalog.js';
import { deadeyeSkillHandlers } from './skills/handlers.js';
import { deadeyeAttributeRules, deadeyeCastRules, deadeyeSchedulerHooks } from './mechanics/malice-rules.js';
import { deadeyeState } from './state.js';
import { deadeyeUi } from './presentation.js';
import { DEADEYE_SKILL_MECHANICS } from './skills/index.js';
import { DEADEYE_BALANCE_PROFILES } from './profiles.js';

export const deadeyeModule = defineNativeModule({
  id: 'Deadeye',
  data: createThiefModuleData('Deadeye', {
    skillMechanics: DEADEYE_SKILL_MECHANICS,
    balanceProfiles: DEADEYE_BALANCE_PROFILES
  }),
  // Same factory for both scheduler and resolver; Deadeye state is fully reconstructed from scratch for each phase
  state: { scheduler: deadeyeState.create, resolver: deadeyeState.create },
  mechanics: {
    modifiers: deadeyeAttributeRules,
    execution: {
      skillHandlers: deadeyeSkillHandlers,
      castRules: deadeyeCastRules,
      hooks: deadeyeSchedulerHooks
    }
  },
  presentation: deadeyeUi
});
