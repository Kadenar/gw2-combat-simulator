import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { createMesmerModuleData } from '../../catalog-data.js';
import { virtuosoAttributeRules, virtuosoCastRules, virtuosoRuntimeHooks } from './rules.js';
import { createVirtuosoResolverState, virtuosoState } from './state.js';
import { virtuosoUi } from './ui.js';
import { MESMER_VIRTUOSO_SKILL_MECHANICS } from './skills.js';
import { virtuosoSkillHandlers } from './handlers.js';
import { VIRTUOSO_BALANCE_PROFILES } from './profiles.js';

export const virtuosoModule = defineNativeModule({
  id: 'Virtuoso',
  data: createMesmerModuleData('Virtuoso', {
    skillMechanics: MESMER_VIRTUOSO_SKILL_MECHANICS,
    balanceProfiles: VIRTUOSO_BALANCE_PROFILES,
    handlers: virtuosoSkillHandlers
  }),
  state: {
    scheduler: virtuosoState.create,
    resolver: createVirtuosoResolverState
  },
  mechanics: {
    modifiers: virtuosoAttributeRules,
    castRules: virtuosoCastRules,
    schedulerHooks: virtuosoRuntimeHooks
  },
  presentation: virtuosoUi
});
