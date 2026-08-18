import { defineNativeModule } from '../../../../platform/gw2/native-profession.js';
import { createElementalistModuleData } from '../../catalog-data.js';
import { weaverAttributeRules, weaverCastRules, weaverSchedulerHooks } from './rules.js';
import { createWeaverState } from './state.js';
import { weaverUi } from './ui.js';
import { WEAVER_SKILL_MECHANICS } from './skills.js';
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
    castRules: weaverCastRules,
    schedulerHooks: weaverSchedulerHooks
  },
  presentation: weaverUi
});
