import { traitDefinitions } from '#gw2/professions/revenant/core/traits/index.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createRevenantModuleData } from '#gw2/professions/revenant/data/module-data.js';
import { createRevenantCoreState, projectRevenantPlanningState } from '#gw2/professions/revenant/core/state.js';
import { revenantCoreUi } from '#gw2/professions/revenant/core/presentation.js';
import {
  REVENANT_CORE_BASE_SKILL_MECHANICS,
  REVENANT_CORE_EXTRA_SKILLS
} from '#gw2/professions/revenant/core/skills/index.js';
import { revenantCoreHooks } from '#gw2/professions/revenant/core/hooks.js';
import { REVENANT_CORE_SKILL_FIELDS } from '#gw2/professions/revenant/core/skill-fields.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const revenantCoreModule = defineNativeModule({
  traitDefinitions,
  id: 'Core',
  data: createRevenantModuleData('Core', {
    skillFields: REVENANT_CORE_SKILL_FIELDS,
    skillMechanics: REVENANT_CORE_BASE_SKILL_MECHANICS,
    extraSkills: REVENANT_CORE_EXTRA_SKILLS
  }),
  state: {
    create: createRevenantCoreState,
    project: projectRevenantPlanningState
  },
  hooks: revenantCoreHooks,
  presentation: revenantCoreUi
});
