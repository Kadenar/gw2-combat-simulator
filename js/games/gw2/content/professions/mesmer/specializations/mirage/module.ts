import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import { createMesmerModuleData } from '#gw2/content/professions/mesmer/catalog/module-data.js';
import {
  mirageAttributeRules,
  mirageCastRules,
  mirageSchedulerHooks,
  mirageSkillMechanicHandlers
} from '#gw2/content/professions/mesmer/specializations/mirage/mechanics/ambush-rules.js';
import { mirageState } from '#gw2/content/professions/mesmer/specializations/mirage/state.js';
import { mirageUi } from '#gw2/content/professions/mesmer/specializations/mirage/presentation.js';
import {
  MESMER_MIRAGE_EXTRA_SKILLS,
  MESMER_MIRAGE_SKILL_MECHANICS,
  MESMER_MIRAGE_SUPPLEMENTAL_SKILL_MECHANICS
} from '#gw2/content/professions/mesmer/specializations/mirage/skills/index.js';
import { mesmerReplaceProfile } from '#gw2/content/professions/mesmer/core/skills/execution.js';
import { MIRAGE_BALANCE_PROFILES } from '#gw2/content/professions/mesmer/specializations/mirage/profiles.js';

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
    // Mirage has no resolver-local state; timeline events carry its resolver data.
    resolver: () => ({})
  },
  mechanics: {
    modifiers: mirageAttributeRules,
    execution: {
      // Mirage dodge and ambush replace their declarative profiles with stateful handlers.
      skillHandlers: Object.freeze({
        'mesmer.mirage-dodge': mesmerReplaceProfile,
        'mesmer.ambush': mesmerReplaceProfile
      }),
      castRules: mirageCastRules,
      skillMechanicHandlers: mirageSkillMechanicHandlers,
      hooks: mirageSchedulerHooks
    }
  },
  presentation: mirageUi
});
