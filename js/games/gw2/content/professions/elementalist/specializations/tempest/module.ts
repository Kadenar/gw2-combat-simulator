import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { onAuraApplied } from '../../../../../integrations/patches/authoring/mechanics.js';
import { createElementalistModuleData } from '../../data/catalog.js';
import { tempestAttributeRules, tempestCastRules, tempestSchedulerHooks } from './mechanics/overloads.js';
import { createTempestState } from './state.js';
import { tempestUi } from './presentation.js';
import { TEMPEST_SKILL_MECHANICS } from './skills/index.js';
import { applyTempestResolverAura } from './mechanics/aura-effects.js';
import { tempestSkillHandlers } from './skills/handlers.js';
import { TEMPEST_BALANCE_PROFILES } from './profiles.js';

export const tempestModule = defineNativeModule({
  id: 'Tempest',
  data: createElementalistModuleData('Tempest', {
    skillMechanics: TEMPEST_SKILL_MECHANICS,
    balanceProfiles: TEMPEST_BALANCE_PROFILES
  }),
  state: { scheduler: createTempestState, resolver: createTempestState },
  mechanics: {
    modifiers: tempestAttributeRules,
    execution: {
      skillHandlers: tempestSkillHandlers,
      castRules: tempestCastRules,
      hooks: tempestSchedulerHooks
    },
    resolution: {
      reactions: [
        onAuraApplied({
          id: 'elementalist.tempest-aura',
          handler: applyTempestResolverAura
        })
      ]
    }
  },
  presentation: tempestUi
});
