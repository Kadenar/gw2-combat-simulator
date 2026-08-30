import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { createRangerModuleData } from '../../data/catalog.js';
import { galeshotSkillHandlers } from './skills/handlers.js';
import { galeshotAttributeRules, galeshotCastRules, galeshotSchedulerHooks } from './mechanics/cyclone-bow-rules.js';
import { GALESHOT_BASE_SKILL_MECHANICS } from './skills/index.js';
import { galeshotState } from './state.js';
import { galeshotUi } from './presentation.js';
import { galeshotEventHandlers } from './mechanics/state-events.js';
import { GALESHOT_BALANCE_PROFILES } from './profiles.js';

export const galeshotModule = defineNativeModule({
  id: 'Galeshot',
  data: createRangerModuleData('Galeshot', {
    skillMechanics: GALESHOT_BASE_SKILL_MECHANICS,
    balanceProfiles: GALESHOT_BALANCE_PROFILES
  }),
  // Both sides share the same factory; the resolver only needs the fields
  // emitted by handleGaleshotState, but reusing the full shape is harmless.
  state: { scheduler: galeshotState.create, resolver: galeshotState.create },
  mechanics: {
    modifiers: galeshotAttributeRules,
    execution: {
      skillHandlers: galeshotSkillHandlers,
      castRules: galeshotCastRules,
      hooks: galeshotSchedulerHooks
    },
    resolution: {
      hooks: { eventHandlers: galeshotEventHandlers }
    }
  },
  presentation: galeshotUi
});
