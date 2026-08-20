import { defineNativeModule } from '../../../../platform/gw2/native-profession.js';
import { createGuardianModuleData } from '../../catalog-data.js';
import { willbenderSkillHandlers } from './handlers.js';
import { willbenderEventHandlers } from './resolver.js';
import { willbenderAttributeRules, willbenderSchedulerHooks, willbenderSkillMechanicHandlers } from './rules.js';
import { WILLBENDER_SKILL_MECHANICS } from './skills.js';
import { willbenderState } from './state.js';
import { willbenderUi } from './ui.js';
import { WILLBENDER_BALANCE_PROFILES } from './profiles.js';

export const willbenderModule = defineNativeModule({
  id: 'Willbender',
  data: createGuardianModuleData('Willbender', {
    skillMechanics: WILLBENDER_SKILL_MECHANICS,
    balanceProfiles: WILLBENDER_BALANCE_PROFILES,
    handlers: willbenderSkillHandlers
  }),
  state: {
    // Scheduler and resolver each get their own independent instance of the same
    // shape; they must not share a reference because the two phases run separately.
    scheduler: willbenderState.create,
    resolver: willbenderState.create
  },
  mechanics: {
    modifiers: willbenderAttributeRules,
    skillMechanicHandlers: willbenderSkillMechanicHandlers,
    schedulerHooks: willbenderSchedulerHooks,
    resolverHooks: { eventHandlers: willbenderEventHandlers }
  },
  presentation: willbenderUi
});
