import { chronomancerHooks } from '#gw2/professions/mesmer/specializations/chronomancer/hooks.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createMesmerModuleData } from '#gw2/professions/mesmer/data/module-data.js';
import { chronomancerModifiers } from '#gw2/professions/mesmer/specializations/chronomancer/modifiers.js';
import { chronomancerState } from '#gw2/professions/mesmer/specializations/chronomancer/state.js';
import { chronomancerUi } from '#gw2/professions/mesmer/specializations/chronomancer/presentation.js';
import {
  MESMER_CHRONOMANCER_EXTRA_SKILLS,
  MESMER_CHRONOMANCER_SKILL_MECHANICS,
  MESMER_CHRONOMANCER_SUPPLEMENTAL_SKILL_MECHANICS
} from '#gw2/professions/mesmer/specializations/chronomancer/skills/index.js';
import { CHRONOMANCER_BALANCE_PROFILES } from '#gw2/professions/mesmer/specializations/chronomancer/profiles.js';

export const chronomancerModule = defineNativeModule({
  id: 'Chronomancer',
  data: createMesmerModuleData('Chronomancer', {
    skillMechanics: MESMER_CHRONOMANCER_SKILL_MECHANICS,
    supplementalSkillMechanics: MESMER_CHRONOMANCER_SUPPLEMENTAL_SKILL_MECHANICS,
    extraSkills: MESMER_CHRONOMANCER_EXTRA_SKILLS,
    balanceProfiles: CHRONOMANCER_BALANCE_PROFILES
  }),
  state: {
    create: chronomancerState.create
  },
  modifiers: chronomancerModifiers,
  hooks: chronomancerHooks,
  presentation: chronomancerUi
});
