import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createGuardianModuleData } from '#gw2/professions/guardian/data/module-data.js';
import { willbenderHooks } from '#gw2/professions/guardian/specializations/willbender/hooks.js';
import { bindWillbenderUi } from '#gw2/professions/guardian/specializations/willbender/presentation.js';
import {
  WILLBENDER_SKILL_MECHANICS,
  WILLBENDER_EXTRA_SKILLS
} from '#gw2/professions/guardian/specializations/willbender/skills/index.js';
import {
  willbenderState,
  projectWillbenderPlanningState
} from '#gw2/professions/guardian/specializations/willbender/state.js';
import { willbenderTraits } from '#gw2/professions/guardian/specializations/willbender/traits/index.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const willbenderModule = defineNativeModule({
  id: 'Willbender',
  data: createGuardianModuleData('Willbender', {
    skillMechanics: WILLBENDER_SKILL_MECHANICS,
    extraSkills: WILLBENDER_EXTRA_SKILLS
  }),
  state: { create: willbenderState.create, project: projectWillbenderPlanningState },
  traitDefinitions: willbenderTraits,
  hooks: willbenderHooks,
  presentation: bindWillbenderUi
});
