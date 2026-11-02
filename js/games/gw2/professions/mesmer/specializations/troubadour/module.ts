import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { TRAIT_LINES } from '#gw2/professions/mesmer/data/trait-lines.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { TROUBADOUR_SKILL_FIELDS } from '#gw2/professions/mesmer/specializations/troubadour/catalog-fields.js';
import { troubadourHooks } from '#gw2/professions/mesmer/specializations/troubadour/hooks.js';
import { luteModifiers } from '#gw2/professions/mesmer/specializations/troubadour/mechanics/instrument-queries.js';
import { troubadourUi } from '#gw2/professions/mesmer/specializations/troubadour/presentation.js';
import { MESMER_TROUBADOUR_SKILLS } from '#gw2/professions/mesmer/specializations/troubadour/skills/index.js';
import {
  projectTroubadourPlanningState,
  troubadourState
} from '#gw2/professions/mesmer/specializations/troubadour/state.js';
import { troubadourTraits } from '#gw2/professions/mesmer/specializations/troubadour/traits/index.js';

export const troubadourModule = defineNativeModule({
  id: 'Troubadour',
  traitDefinitions: troubadourTraits,
  data: createNativeModuleData<MesmerSkill>({
    id: 'Troubadour',
    traitLines: TRAIT_LINES,
    skillFields: TROUBADOUR_SKILL_FIELDS,
    skills: MESMER_TROUBADOUR_SKILLS
  }),
  state: {
    create: troubadourState.create,
    project: projectTroubadourPlanningState
  },
  // Register the skill/mechanic-owned rules alongside trait declarations.
  modifiers: luteModifiers,
  hooks: troubadourHooks,
  presentation: troubadourUi
});
