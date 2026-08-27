import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { onAuraApplied } from '../../../../../integrations/patches/authoring/mechanics.js';
import { createElementalistModuleData } from '../../catalog-data.js';
import { tempestAttributeRules, tempestCastRules, tempestSchedulerHooks } from './rules.js';
import { createTempestState } from './state.js';
import { tempestUi } from './ui.js';
import { TEMPEST_SKILL_MECHANICS } from './skills.js';
import { applyTempestResolverAura } from './resolver.js';
import { tempestSkillHandlers } from './handlers.js';
import { TEMPEST_BALANCE_PROFILES } from './profiles.js';

export const tempestModule = defineNativeModule({
  id: 'Tempest',
  data: createElementalistModuleData('Tempest', {
    skillMechanics: TEMPEST_SKILL_MECHANICS,
    balanceProfiles: TEMPEST_BALANCE_PROFILES,
    handlers: tempestSkillHandlers
  }),
  state: { scheduler: createTempestState, resolver: createTempestState },
  mechanics: {
    modifiers: tempestAttributeRules,
    castRules: tempestCastRules,
    schedulerHooks: tempestSchedulerHooks,
    reactions: [
      onAuraApplied({
        id: 'elementalist.tempest-aura',
        handler: applyTempestResolverAura
      })
    ]
  },
  presentation: tempestUi
});
