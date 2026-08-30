import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { createMesmerModuleData } from '../../data/catalog.js';
import { virtuosoAttributeRules, virtuosoCastRules, virtuosoRuntimeHooks } from './mechanics/blades-and-bladesongs.js';
import { createVirtuosoResolverState, virtuosoState } from './state.js';
import { virtuosoUi } from './presentation.js';
import { MESMER_VIRTUOSO_SKILL_MECHANICS } from './skills/index.js';
import { virtuosoSkillHandlers } from './skills/handlers.js';
import { VIRTUOSO_BALANCE_PROFILES } from './profiles.js';

export const virtuosoModule = defineNativeModule({
  id: 'Virtuoso',
  data: createMesmerModuleData('Virtuoso', {
    skillMechanics: MESMER_VIRTUOSO_SKILL_MECHANICS,
    balanceProfiles: VIRTUOSO_BALANCE_PROFILES
  }),
  state: {
    scheduler: virtuosoState.create,
    resolver: createVirtuosoResolverState
  },
  mechanics: {
    modifiers: virtuosoAttributeRules,
    execution: {
      skillHandlers: virtuosoSkillHandlers,
      castRules: virtuosoCastRules,
      hooks: virtuosoRuntimeHooks
    }
  },
  presentation: virtuosoUi
});
