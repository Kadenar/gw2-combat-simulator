import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import { sicEmPlayerModifiers } from '#gw2/professions/ranger/core/skills/slot-skills.js';
import { TRAIT_LINES } from '#gw2/professions/ranger/data/trait-lines.js';
import { soulbeastAttributes } from '#gw2/professions/ranger/specializations/soulbeast/attributes.js';
import { RANGER_SOULBEAST_PROFILE_FIELDS } from '#gw2/professions/ranger/specializations/soulbeast/catalog-fields.js';
import { soulbeastHooks } from '#gw2/professions/ranger/specializations/soulbeast/hooks.js';
import { bindSoulbeastUi } from '#gw2/professions/ranger/specializations/soulbeast/presentation.js';
import { SOULBEAST_BASE_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/index.js';
import {
  projectSoulbeastPlanningState,
  soulbeastState
} from '#gw2/professions/ranger/specializations/soulbeast/state.js';
import { soulbeastTraits } from '#gw2/professions/ranger/specializations/soulbeast/traits/index.js';
import type { RangerSkill } from '#gw2/professions/ranger/types.js';

/** The module registers one live mechanic owner beside its existing data and modifier formulas. */
export const soulbeastModule = defineNativeModule({
  id: 'Soulbeast',
  attributes: soulbeastAttributes,
  traitDefinitions: soulbeastTraits,
  data: createNativeModuleData<RangerSkill>({
    id: 'Soulbeast',
    traitLines: TRAIT_LINES,
    profileFields: RANGER_SOULBEAST_PROFILE_FIELDS,
    skills: materializeSkillDefinitions(SOULBEAST_BASE_SKILL_MECHANICS)
  }),
  state: { create: soulbeastState.create, project: projectSoulbeastPlanningState },
  // The merged command bonus belongs to this elite; Core traits register their own rules.
  modifiers: sicEmPlayerModifiers,
  hooks: soulbeastHooks,
  presentation: bindSoulbeastUi
});
