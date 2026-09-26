import { mesmerCoreHooks } from '#gw2/professions/mesmer/core/hooks.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createMesmerModuleData } from '#gw2/professions/mesmer/data/module-data.js';
import { mesmerCoreModifiers } from '#gw2/professions/mesmer/core/modifiers.js';
import { createMesmerCoreState } from '#gw2/professions/mesmer/core/state.js';
import { projectMesmerPlanningState } from '#gw2/professions/mesmer/family-state.js';
import { mesmerCoreUi } from '#gw2/professions/mesmer/core/presentation.js';
import { MESMER_CORE_EXTRA_SKILLS } from '#gw2/professions/mesmer/core/skills/actions.js';
import { MESMER_CORE_SKILL_MECHANICS } from '#gw2/professions/mesmer/core/skills/index.js';
import { MESMER_CORE_SUPPLEMENTAL_SKILL_MECHANICS } from '#gw2/professions/mesmer/core/skills/supplemental-skills.js';
import { MESMER_CORE_BALANCE_PROFILES } from '#gw2/professions/mesmer/core/profiles.js';

export const mesmerCoreModule = defineNativeModule({
  id: 'Core',
  data: createMesmerModuleData('Core', {
    skillMechanics: MESMER_CORE_SKILL_MECHANICS,
    supplementalSkillMechanics: MESMER_CORE_SUPPLEMENTAL_SKILL_MECHANICS,
    extraSkills: MESMER_CORE_EXTRA_SKILLS,
    balanceProfiles: MESMER_CORE_BALANCE_PROFILES
  }),
  state: {
    create: createMesmerCoreState,
    project: projectMesmerPlanningState
  },
  modifiers: mesmerCoreModifiers,
  hooks: mesmerCoreHooks,
  presentation: mesmerCoreUi
});
