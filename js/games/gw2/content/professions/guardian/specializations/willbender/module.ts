import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { createGuardianModuleData } from '../../data/catalog.js';
import { willbenderSkillHandlers } from './skills/handlers.js';
import { willbenderEventHandlers } from './mechanics/virtue-effects.js';
import {
  willbenderAttributeRules,
  willbenderSchedulerHooks,
  willbenderSkillMechanicHandlers
} from './mechanics/virtue-rules.js';
import { WILLBENDER_SKILL_MECHANICS } from './skills/index.js';
import { willbenderState } from './state.js';
import { willbenderUi } from './presentation.js';
import { WILLBENDER_BALANCE_PROFILES } from './profiles.js';

export const willbenderModule = defineNativeModule({
  id: 'Willbender',
  data: createGuardianModuleData('Willbender', {
    skillMechanics: WILLBENDER_SKILL_MECHANICS,
    balanceProfiles: WILLBENDER_BALANCE_PROFILES
  }),
  state: {
    // Scheduler and resolver each get their own independent instance of the same
    // shape; they must not share a reference because the two phases run separately.
    scheduler: willbenderState.create,
    resolver: willbenderState.create
  },
  mechanics: {
    modifiers: willbenderAttributeRules,
    execution: {
      skillHandlers: willbenderSkillHandlers,
      skillMechanicHandlers: willbenderSkillMechanicHandlers,
      hooks: willbenderSchedulerHooks
    },
    resolution: {
      hooks: { eventHandlers: willbenderEventHandlers }
    }
  },
  presentation: willbenderUi
});
