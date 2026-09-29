import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createMesmerModuleData } from '#gw2/professions/mesmer/data/module-data.js';
import { troubadourHooks } from '#gw2/professions/mesmer/specializations/troubadour/hooks.js';
import { troubadourModifiers } from '#gw2/professions/mesmer/specializations/troubadour/modifiers.js';
import { troubadourUi } from '#gw2/professions/mesmer/specializations/troubadour/presentation.js';
import { TROUBADOUR_BALANCE_PROFILES } from '#gw2/professions/mesmer/specializations/troubadour/profiles.js';
import {
  MESMER_TROUBADOUR_EXTRA_SKILLS,
  MESMER_TROUBADOUR_SKILL_MECHANICS,
  MESMER_TROUBADOUR_SUPPLEMENTAL_SKILL_MECHANICS
} from '#gw2/professions/mesmer/specializations/troubadour/skills/index.js';
import {
  projectTroubadourPlanningState,
  troubadourState
} from '#gw2/professions/mesmer/specializations/troubadour/state.js';
import { troubadourTraits } from '#gw2/professions/mesmer/specializations/troubadour/traits/index.js';

export const troubadourModule = defineNativeModule({
  id: 'Troubadour',
  traitDefinitions: troubadourTraits,
  data: createMesmerModuleData('Troubadour', {
    skillMechanics: MESMER_TROUBADOUR_SKILL_MECHANICS,
    supplementalSkillMechanics: MESMER_TROUBADOUR_SUPPLEMENTAL_SKILL_MECHANICS,
    extraSkills: MESMER_TROUBADOUR_EXTRA_SKILLS,
    balanceProfiles: TROUBADOUR_BALANCE_PROFILES
  }),
  state: {
    create: troubadourState.create,
    project: projectTroubadourPlanningState
  },
  modifiers: troubadourModifiers,
  hooks: troubadourHooks,
  presentation: troubadourUi
});
