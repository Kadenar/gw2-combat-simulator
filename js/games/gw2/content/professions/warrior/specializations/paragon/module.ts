import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { createWarriorModuleData } from '../../data/catalog.js';
import { PARAGON_SKILL_MECHANICS } from './skills/index.js';
import { paragonSkillHandlers } from './skills/handlers.js';
import { paragonAttributeRules, paragonSchedulerHooks } from './mechanics/chants-and-motivation.js';
import { paragonState } from './state.js';
import { paragonUi } from './presentation.js';
import { paragonResolverEventHandlers } from './mechanics/chant-effects.js';
import { PARAGON_BALANCE_PROFILES } from './profiles.js';

export const paragonModule = defineNativeModule({
  id: 'Paragon',
  data: createWarriorModuleData('Paragon', {
    skillMechanics: PARAGON_SKILL_MECHANICS,
    balanceProfiles: PARAGON_BALANCE_PROFILES
  }),
  state: { scheduler: paragonState.create, resolver: paragonState.create },
  mechanics: {
    modifiers: paragonAttributeRules,
    execution: {
      skillHandlers: paragonSkillHandlers,
      hooks: paragonSchedulerHooks
    },
    resolution: {
      hooks: { eventHandlers: paragonResolverEventHandlers }
    }
  },
  presentation: paragonUi
});
