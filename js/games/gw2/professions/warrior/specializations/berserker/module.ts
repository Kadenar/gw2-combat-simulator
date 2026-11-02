import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import { TRAIT_LINES } from '#gw2/professions/warrior/data/trait-lines.js';
import { berserkerAttributes } from '#gw2/professions/warrior/specializations/berserker/attributes.js';
import { BERSERKER_SKILL_FIELDS } from '#gw2/professions/warrior/specializations/berserker/catalog-fields.js';
import { berserkerHooks } from '#gw2/professions/warrior/specializations/berserker/hooks.js';
import { berserkerUi } from '#gw2/professions/warrior/specializations/berserker/presentation.js';
import { BERSERKER_SKILL_MECHANICS } from '#gw2/professions/warrior/specializations/berserker/skills/index.js';
import {
  berserkerState,
  projectBerserkerPlanningState
} from '#gw2/professions/warrior/specializations/berserker/state.js';
import { warriorBerserkerTraits } from '#gw2/professions/warrior/specializations/berserker/traits/index.js';
import type { WarriorSkill } from '#gw2/professions/warrior/types.js';

export const berserkerModule = defineNativeModule({
  traitDefinitions: warriorBerserkerTraits,
  id: 'Berserker',
  data: createNativeModuleData<WarriorSkill>({
    id: 'Berserker',
    traitLines: TRAIT_LINES,
    skillFields: BERSERKER_SKILL_FIELDS,
    skills: materializeSkillDefinitions(BERSERKER_SKILL_MECHANICS)
  }),
  state: { create: berserkerState.create, project: projectBerserkerPlanningState },
  // Preserve the live Berserker attribute contributions.
  attributes: berserkerAttributes,
  hooks: berserkerHooks,
  presentation: berserkerUi
});
