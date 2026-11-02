import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import { TRAIT_LINES } from '#gw2/professions/engineer/data/trait-lines.js';
import {
  ENGINEER_HOLOSMITH_PROFILE_FIELDS,
  HOLOSMITH_SKILL_FIELDS
} from '#gw2/professions/engineer/specializations/holosmith/catalog-fields.js';
import { holosmithHooks } from '#gw2/professions/engineer/specializations/holosmith/hooks.js';
import { holosmithModifiers } from '#gw2/professions/engineer/specializations/holosmith/modifiers.js';
import { bindHolosmithUi } from '#gw2/professions/engineer/specializations/holosmith/presentation.js';
import { ENGINEER_HOLOSMITH_AUTOATTACK_CHAINS } from '#gw2/professions/engineer/specializations/holosmith/skills/autoattack-chains.js';
import { HOLOSMITH_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/holosmith/skills/index.js';
import { ENGINEER_HOLOSMITH_SKILL_FLIPS } from '#gw2/professions/engineer/specializations/holosmith/skills/skill-flips.js';
import {
  holosmithState,
  projectHolosmithPlanningState
} from '#gw2/professions/engineer/specializations/holosmith/state.js';
import { holosmithTraits } from '#gw2/professions/engineer/specializations/holosmith/traits/index.js';
import type { EngineerSkill } from '#gw2/professions/engineer/types.js';

export const holosmithModule = defineNativeModule({
  id: 'Holosmith',
  traitDefinitions: holosmithTraits,
  data: createNativeModuleData<EngineerSkill>({
    id: 'Holosmith',
    traitLines: TRAIT_LINES,
    skillFlips: ENGINEER_HOLOSMITH_SKILL_FLIPS,
    profileFields: ENGINEER_HOLOSMITH_PROFILE_FIELDS,
    skillFields: HOLOSMITH_SKILL_FIELDS,
    skills: materializeSkillDefinitions(HOLOSMITH_SKILL_MECHANICS),
    autoattackChains: ENGINEER_HOLOSMITH_AUTOATTACK_CHAINS
  }),
  // Heat tasks and impact formulas read the same live specialization state.
  state: { create: holosmithState.create, project: projectHolosmithPlanningState },
  modifiers: holosmithModifiers,
  hooks: holosmithHooks,
  presentation: bindHolosmithUi
});
