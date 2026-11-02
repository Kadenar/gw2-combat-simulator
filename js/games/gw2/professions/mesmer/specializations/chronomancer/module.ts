import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { TRAIT_LINES } from '#gw2/professions/mesmer/data/trait-lines.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { chronomancerHooks } from '#gw2/professions/mesmer/specializations/chronomancer/hooks.js';
import { chronomancerUi } from '#gw2/professions/mesmer/specializations/chronomancer/presentation.js';
import { MESMER_CHRONOMANCER_SKILLS } from '#gw2/professions/mesmer/specializations/chronomancer/skills/index.js';
import {
  chronomancerState,
  projectChronomancerPlanningState
} from '#gw2/professions/mesmer/specializations/chronomancer/state.js';
import { chronomancerTraits } from '#gw2/professions/mesmer/specializations/chronomancer/traits/index.js';

export const chronomancerModule = defineNativeModule({
  id: 'Chronomancer',
  data: createNativeModuleData<MesmerSkill>({
    id: 'Chronomancer',
    traitLines: TRAIT_LINES,
    skills: MESMER_CHRONOMANCER_SKILLS
  }),
  state: {
    create: chronomancerState.create,
    project: projectChronomancerPlanningState
  },
  traitDefinitions: chronomancerTraits,
  hooks: chronomancerHooks,
  presentation: chronomancerUi
});
