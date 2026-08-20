import { defineNativeModule } from '../../../../platform/gw2/native-profession.js';
import { createMesmerModuleData } from '../../catalog-data.js';
import {
  troubadourAttributeRules,
  troubadourCastRules,
  troubadourSchedulerHooks,
  troubadourSkillMechanicHandlers
} from './rules.js';
import { createTroubadourResolverState, troubadourState } from './state.js';
import { troubadourUi } from './ui.js';
import {
  MESMER_TROUBADOUR_EXTRA_SKILLS,
  MESMER_TROUBADOUR_SKILL_MECHANICS,
  MESMER_TROUBADOUR_SUPPLEMENTAL_SKILL_MECHANICS
} from './skills.js';
import { troubadourSkillHandlers } from './handlers.js';
import { troubadourEventHandlers } from './resolver.js';
import { TROUBADOUR_BALANCE_PROFILES } from './profiles.js';

export const troubadourModule = defineNativeModule({
  id: 'Troubadour',
  data: createMesmerModuleData('Troubadour', {
    skillMechanics: MESMER_TROUBADOUR_SKILL_MECHANICS,
    supplementalSkillMechanics: MESMER_TROUBADOUR_SUPPLEMENTAL_SKILL_MECHANICS,
    extraSkills: MESMER_TROUBADOUR_EXTRA_SKILLS,
    balanceProfiles: TROUBADOUR_BALANCE_PROFILES,
    handlers: troubadourSkillHandlers
  }),
  state: {
    scheduler: troubadourState.create,
    resolver: createTroubadourResolverState
  },
  mechanics: {
    modifiers: troubadourAttributeRules,
    castRules: troubadourCastRules,
    skillMechanicHandlers: troubadourSkillMechanicHandlers,
    schedulerHooks: troubadourSchedulerHooks,
    resolverHooks: { eventHandlers: troubadourEventHandlers }
  },
  presentation: troubadourUi
});
