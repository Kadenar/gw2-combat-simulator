import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import { TRAIT_LINES } from '#gw2/professions/ranger/data/trait-lines.js';
import { GALESHOT_SKILL_FIELDS } from '#gw2/professions/ranger/specializations/galeshot/catalog-fields.js';
import { galeshotHooks } from '#gw2/professions/ranger/specializations/galeshot/hooks.js';
import { bindGaleshotUi } from '#gw2/professions/ranger/specializations/galeshot/presentation.js';
import { GALESHOT_BASE_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/galeshot/skills/index.js';
import { galeshotState, projectGaleshotPlanningState } from '#gw2/professions/ranger/specializations/galeshot/state.js';
import { galeshotTraits } from '#gw2/professions/ranger/specializations/galeshot/traits/index.js';
import type { RangerSkill } from '#gw2/professions/ranger/types.js';

/** The module registers one live mechanic owner beside its existing data and modifier formulas. */
export const galeshotModule = defineNativeModule({
  id: 'Galeshot',
  data: createNativeModuleData<RangerSkill>({
    id: 'Galeshot',
    traitLines: TRAIT_LINES,
    skillFields: GALESHOT_SKILL_FIELDS,
    skills: materializeSkillDefinitions(GALESHOT_BASE_SKILL_MECHANICS)
  }),
  state: { create: galeshotState.create, project: projectGaleshotPlanningState },
  traitDefinitions: galeshotTraits,
  hooks: galeshotHooks,
  presentation: bindGaleshotUi
});
