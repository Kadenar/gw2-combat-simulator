import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import { TRAIT_LINES } from '#gw2/professions/warrior/data/trait-lines.js';
import {
  PARAGON_SKILL_FIELDS,
  WARRIOR_PARAGON_PROFILE_FIELDS
} from '#gw2/professions/warrior/specializations/paragon/catalog-fields.js';
import { paragonHooks } from '#gw2/professions/warrior/specializations/paragon/hooks.js';
import { paragonUi } from '#gw2/professions/warrior/specializations/paragon/presentation.js';
import { PARAGON_SKILL_MECHANICS } from '#gw2/professions/warrior/specializations/paragon/skills/index.js';
import { paragonState, projectParagonPlanningState } from '#gw2/professions/warrior/specializations/paragon/state.js';
import { warriorParagonTraits } from '#gw2/professions/warrior/specializations/paragon/traits/index.js';
import type { WarriorSkill } from '#gw2/professions/warrior/types.js';

export const paragonModule = defineNativeModule({
  traitDefinitions: warriorParagonTraits,
  id: 'Paragon',
  data: createNativeModuleData<WarriorSkill>({
    id: 'Paragon',
    traitLines: TRAIT_LINES,
    profileFields: WARRIOR_PARAGON_PROFILE_FIELDS,
    skills: materializeSkillDefinitions(PARAGON_SKILL_MECHANICS),
    skillFields: PARAGON_SKILL_FIELDS
  }),
  state: { create: paragonState.create, project: projectParagonPlanningState },
  hooks: paragonHooks,
  presentation: paragonUi
});
