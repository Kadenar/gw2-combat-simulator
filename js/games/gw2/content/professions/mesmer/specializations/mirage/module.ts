import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { createMesmerModuleData } from '../../data/catalog.js';
import { mirageAttributeRules, mirageCastRules, mirageSchedulerHooks, mirageSkillMechanicHandlers } from './rules.js';
import { createMirageResolverState, mirageState } from './state.js';
import { mirageUi } from './presentation.js';
import {
  MESMER_MIRAGE_EXTRA_SKILLS,
  MESMER_MIRAGE_SKILL_MECHANICS,
  MESMER_MIRAGE_SUPPLEMENTAL_SKILL_MECHANICS
} from './skills.js';
import { mirageSkillHandlers } from './handlers.js';
import { MIRAGE_BALANCE_PROFILES } from './profiles.js';

export const mirageModule = defineNativeModule({
  id: 'Mirage',
  data: createMesmerModuleData('Mirage', {
    skillMechanics: MESMER_MIRAGE_SKILL_MECHANICS,
    supplementalSkillMechanics: MESMER_MIRAGE_SUPPLEMENTAL_SKILL_MECHANICS,
    extraSkills: MESMER_MIRAGE_EXTRA_SKILLS,
    balanceProfiles: MIRAGE_BALANCE_PROFILES,
    handlers: mirageSkillHandlers
  }),
  state: {
    scheduler: mirageState.create,
    resolver: createMirageResolverState
  },
  mechanics: {
    modifiers: mirageAttributeRules,
    castRules: mirageCastRules,
    skillMechanicHandlers: mirageSkillMechanicHandlers,
    schedulerHooks: mirageSchedulerHooks
  },
  presentation: mirageUi
});
