import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { TRAIT_LINES } from '#gw2/professions/revenant/data/trait-lines.js';
import { vindicatorHooks } from '#gw2/professions/revenant/specializations/vindicator/hooks.js';
import { vindicatorUi } from '#gw2/professions/revenant/specializations/vindicator/presentation.js';
import { VINDICATOR_SKILLS } from '#gw2/professions/revenant/specializations/vindicator/skills/index.js';
import {
  projectVindicatorPlanningState,
  vindicatorState
} from '#gw2/professions/revenant/specializations/vindicator/state.js';
import { traitDefinitions } from '#gw2/professions/revenant/specializations/vindicator/traits/index.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const vindicatorModule = defineNativeModule({
  traitDefinitions,
  id: 'Vindicator',
  data: createNativeModuleData<RevenantSkill>({
    id: 'Vindicator',
    traitLines: TRAIT_LINES,
    skills: VINDICATOR_SKILLS
  }),
  state: { create: vindicatorState.create, project: projectVindicatorPlanningState },
  hooks: vindicatorHooks,
  presentation: vindicatorUi
});
