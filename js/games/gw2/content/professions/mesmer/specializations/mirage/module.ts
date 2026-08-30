import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { createMesmerModuleData } from '../../data/catalog.js';
import {
  mirageAttributeRules,
  mirageCastRules,
  mirageSchedulerHooks,
  mirageSkillMechanicHandlers
} from './mechanics/ambush-rules.js';
import { createMirageResolverState, mirageState } from './state.js';
import { mirageUi } from './presentation.js';
import {
  MESMER_MIRAGE_EXTRA_SKILLS,
  MESMER_MIRAGE_SKILL_MECHANICS,
  MESMER_MIRAGE_SUPPLEMENTAL_SKILL_MECHANICS
} from './skills/index.js';
import { mirageSkillHandlers } from './skills/handlers.js';
import { MIRAGE_BALANCE_PROFILES } from './profiles.js';

export const mirageModule = defineNativeModule({
  id: 'Mirage',
  data: createMesmerModuleData('Mirage', {
    skillMechanics: MESMER_MIRAGE_SKILL_MECHANICS,
    supplementalSkillMechanics: MESMER_MIRAGE_SUPPLEMENTAL_SKILL_MECHANICS,
    extraSkills: MESMER_MIRAGE_EXTRA_SKILLS,
    balanceProfiles: MIRAGE_BALANCE_PROFILES
  }),
  state: {
    scheduler: mirageState.create,
    resolver: createMirageResolverState
  },
  mechanics: {
    modifiers: mirageAttributeRules,
    execution: {
      skillHandlers: mirageSkillHandlers,
      castRules: mirageCastRules,
      skillMechanicHandlers: mirageSkillMechanicHandlers,
      hooks: mirageSchedulerHooks
    }
  },
  presentation: mirageUi
});
