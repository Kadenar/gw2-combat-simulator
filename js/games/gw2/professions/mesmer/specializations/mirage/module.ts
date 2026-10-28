import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createMesmerModuleData } from '#gw2/professions/mesmer/data/module-data.js';
import { MIRAGE_SKILL_FIELDS } from '#gw2/professions/mesmer/specializations/mirage/catalog-fields.js';
import { mirageHooks } from '#gw2/professions/mesmer/specializations/mirage/hooks.js';
import { mirageUi } from '#gw2/professions/mesmer/specializations/mirage/presentation.js';
import {
  MESMER_MIRAGE_EXTRA_SKILLS,
  MESMER_MIRAGE_SKILL_MECHANICS
} from '#gw2/professions/mesmer/specializations/mirage/skills/index.js';
import { mirageState, projectMiragePlanningState } from '#gw2/professions/mesmer/specializations/mirage/state.js';
import { mirageTraits } from '#gw2/professions/mesmer/specializations/mirage/traits/index.js';

export const mirageModule = defineNativeModule({
  id: 'Mirage',
  data: createMesmerModuleData('Mirage', {
    skillFields: MIRAGE_SKILL_FIELDS,
    skillMechanics: MESMER_MIRAGE_SKILL_MECHANICS,
    extraSkills: MESMER_MIRAGE_EXTRA_SKILLS
  }),
  state: {
    create: mirageState.create,
    project: projectMiragePlanningState
  },
  traitDefinitions: mirageTraits,
  hooks: mirageHooks,
  presentation: mirageUi
});
