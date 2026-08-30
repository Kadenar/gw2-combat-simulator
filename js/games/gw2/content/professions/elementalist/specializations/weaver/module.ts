import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { createElementalistModuleData } from '../../data/catalog.js';
import {
  weaverAttributeRules,
  weaverCastRules,
  weaverSchedulerHooks,
  weaverSkillMechanicHandlers
} from './mechanics/dual-attunements.js';
import { createWeaverState } from './state.js';
import { weaverUi } from './presentation.js';
import { WEAVER_SKILL_MECHANICS } from './skills/index.js';
import { WEAVER_BALANCE_PROFILES } from './profiles.js';

export const weaverModule = defineNativeModule({
  id: 'Weaver',
  data: createElementalistModuleData('Weaver', {
    skillMechanics: WEAVER_SKILL_MECHANICS,
    balanceProfiles: WEAVER_BALANCE_PROFILES
  }),
  state: { scheduler: createWeaverState, resolver: createWeaverState },
  mechanics: {
    modifiers: weaverAttributeRules,
    execution: {
      castRules: weaverCastRules,
      skillMechanicHandlers: weaverSkillMechanicHandlers,
      hooks: weaverSchedulerHooks
    }
  },
  presentation: weaverUi
});
