import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { createThiefModuleData } from '../../data/catalog.js';
import { daredevilAttributeRules, daredevilCastRules, daredevilSchedulerHooks } from './rules.js';
import { daredevilState } from './state.js';
import { DAREDEVIL_SKILL_MECHANICS } from './skills.js';
import { DAREDEVIL_BALANCE_PROFILES } from './profiles.js';
import { daredevilUi } from './presentation.js';

export const daredevilModule = defineNativeModule({
  id: 'Daredevil',
  data: createThiefModuleData('Daredevil', {
    skillMechanics: DAREDEVIL_SKILL_MECHANICS,
    balanceProfiles: DAREDEVIL_BALANCE_PROFILES
  }),
  // Scheduler and resolver each get their own independent DaredevilState instance
  state: { scheduler: daredevilState.create, resolver: daredevilState.create },
  mechanics: {
    modifiers: daredevilAttributeRules,
    castRules: daredevilCastRules,
    schedulerHooks: daredevilSchedulerHooks
  },
  presentation: daredevilUi
});
