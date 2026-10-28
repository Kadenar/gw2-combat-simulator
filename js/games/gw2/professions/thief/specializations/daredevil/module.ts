import { DAREDEVIL_GUILD_ATTACK_SKILLS } from '#gw2/professions/thief/specializations/daredevil/skills/guild-attacks.js';
import { daredevilTraits } from '#gw2/professions/thief/specializations/daredevil/traits/index.js';
import { projectDaredevilPlanningState } from '#gw2/professions/thief/specializations/daredevil/state.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createThiefModuleData } from '#gw2/professions/thief/data/module-data.js';

import { daredevilState } from '#gw2/professions/thief/specializations/daredevil/state.js';
import { DAREDEVIL_SKILL_MECHANICS } from '#gw2/professions/thief/specializations/daredevil/skills/index.js';
import { daredevilUi } from '#gw2/professions/thief/specializations/daredevil/presentation.js';
import { daredevilHooks } from '#gw2/professions/thief/specializations/daredevil/hooks.js';

export const daredevilModule = defineNativeModule({
  traitDefinitions: daredevilTraits,
  id: 'Daredevil',
  data: createThiefModuleData('Daredevil', {
    extraSkills: DAREDEVIL_GUILD_ATTACK_SKILLS,
    skillMechanics: DAREDEVIL_SKILL_MECHANICS
  }),
  state: { create: daredevilState.create, project: projectDaredevilPlanningState },
  hooks: daredevilHooks,
  presentation: daredevilUi
});
