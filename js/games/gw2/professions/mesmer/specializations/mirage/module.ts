import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { TRAIT_LINES } from '#gw2/professions/mesmer/data/trait-lines.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
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
  data: createNativeModuleData<MesmerSkill>({
    id: 'Mirage',
    traitLines: TRAIT_LINES,
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
