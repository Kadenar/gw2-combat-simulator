import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createRevenantModuleData } from '#gw2/professions/revenant/data/module-data.js';
import { VINDICATOR_DODGE_INPUT } from '#gw2/professions/revenant/data/vindicator-dodge.js';
import { vindicatorHooks } from '#gw2/professions/revenant/specializations/vindicator/hooks.js';
import { vindicatorUi } from '#gw2/professions/revenant/specializations/vindicator/presentation.js';
import { VINDICATOR_BASE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/vindicator/skills/index.js';
import {
  projectVindicatorPlanningState,
  vindicatorState
} from '#gw2/professions/revenant/specializations/vindicator/state.js';
import { traitDefinitions } from '#gw2/professions/revenant/specializations/vindicator/traits/index.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const vindicatorModule = defineNativeModule({
  traitDefinitions,
  id: 'Vindicator',
  data: createRevenantModuleData('Vindicator', {
    skillMechanics: VINDICATOR_BASE_SKILL_MECHANICS,
    extraSkills: [VINDICATOR_DODGE_INPUT]
  }),
  state: { create: vindicatorState.create, project: projectVindicatorPlanningState },
  hooks: vindicatorHooks,
  presentation: vindicatorUi
});
