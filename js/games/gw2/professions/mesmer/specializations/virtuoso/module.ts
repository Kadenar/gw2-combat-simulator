import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import { TRAIT_LINES } from '#gw2/professions/mesmer/data/trait-lines.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { MESMER_VIRTUOSO_PROFILE_FIELDS } from '#gw2/professions/mesmer/specializations/virtuoso/catalog-fields.js';
import { virtuosoHooks } from '#gw2/professions/mesmer/specializations/virtuoso/hooks.js';
import { virtuosoUi } from '#gw2/professions/mesmer/specializations/virtuoso/presentation.js';
import { MESMER_VIRTUOSO_SKILL_MECHANICS } from '#gw2/professions/mesmer/specializations/virtuoso/skills/index.js';
import { projectVirtuosoPlanningState, virtuosoState } from '#gw2/professions/mesmer/specializations/virtuoso/state.js';
import { virtuosoTraits } from '#gw2/professions/mesmer/specializations/virtuoso/traits/index.js';

export const virtuosoModule = defineNativeModule({
  id: 'Virtuoso',
  data: createNativeModuleData<MesmerSkill>({
    id: 'Virtuoso',
    traitLines: TRAIT_LINES,
    profileFields: MESMER_VIRTUOSO_PROFILE_FIELDS,
    skills: materializeSkillDefinitions(MESMER_VIRTUOSO_SKILL_MECHANICS)
  }),
  state: {
    create: virtuosoState.create,
    project: projectVirtuosoPlanningState
  },
  traitDefinitions: virtuosoTraits,
  hooks: virtuosoHooks,
  presentation: virtuosoUi
});
