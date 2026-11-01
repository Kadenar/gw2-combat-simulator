import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { TRAIT_LINES } from '#gw2/professions/thief/data/trait-lines.js';
import { daredevilHooks } from '#gw2/professions/thief/specializations/daredevil/hooks.js';
import { daredevilUi } from '#gw2/professions/thief/specializations/daredevil/presentation.js';
import { DAREDEVIL_GUILD_ATTACK_SKILLS } from '#gw2/professions/thief/specializations/daredevil/skills/guild-attacks.js';
import { DAREDEVIL_SKILL_MECHANICS } from '#gw2/professions/thief/specializations/daredevil/skills/index.js';
import { THIEF_DAREDEVIL_SKILL_FLIPS } from '#gw2/professions/thief/specializations/daredevil/skills/skill-flips.js';
import {
  daredevilState,
  projectDaredevilPlanningState
} from '#gw2/professions/thief/specializations/daredevil/state.js';
import { daredevilTraits } from '#gw2/professions/thief/specializations/daredevil/traits/index.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

export const daredevilModule = defineNativeModule({
  traitDefinitions: daredevilTraits,
  id: 'Daredevil',
  data: createNativeModuleData<ThiefSkill>({
    id: 'Daredevil',
    traitLines: TRAIT_LINES,
    skillFlips: THIEF_DAREDEVIL_SKILL_FLIPS,
    extraSkills: DAREDEVIL_GUILD_ATTACK_SKILLS,
    skillMechanics: DAREDEVIL_SKILL_MECHANICS
  }),
  state: { create: daredevilState.create, project: projectDaredevilPlanningState },
  hooks: daredevilHooks,
  presentation: daredevilUi
});
