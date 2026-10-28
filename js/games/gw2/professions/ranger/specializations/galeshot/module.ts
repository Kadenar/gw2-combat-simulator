import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createRangerModuleData } from '#gw2/professions/ranger/data/module-data.js';
import { GALESHOT_SKILL_FIELDS } from '#gw2/professions/ranger/specializations/galeshot/catalog-fields.js';
import { galeshotHooks } from '#gw2/professions/ranger/specializations/galeshot/hooks.js';
import { bindGaleshotUi } from '#gw2/professions/ranger/specializations/galeshot/presentation.js';
import {
  GALESHOT_BASE_SKILL_MECHANICS,
  piercingGalesModifier
} from '#gw2/professions/ranger/specializations/galeshot/skills/index.js';
import { galeshotState, projectGaleshotPlanningState } from '#gw2/professions/ranger/specializations/galeshot/state.js';
import { galeshotTraits } from '#gw2/professions/ranger/specializations/galeshot/traits/index.js';

/** The module registers one live mechanic owner beside its existing data and modifier formulas. */
export const galeshotModule = defineNativeModule({
  id: 'Galeshot',
  traitDefinitions: galeshotTraits,
  data: createRangerModuleData('Galeshot', {
    skillFields: GALESHOT_SKILL_FIELDS,
    skillMechanics: GALESHOT_BASE_SKILL_MECHANICS
  }),
  state: { create: galeshotState.create, project: projectGaleshotPlanningState },
  // The skill modifier keeps its position after Galeshot's trait rules.
  modifiers: [{ ...piercingGalesModifier, order: 103 }],
  hooks: galeshotHooks,
  presentation: bindGaleshotUi
});
