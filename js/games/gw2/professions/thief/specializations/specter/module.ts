import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { TRAIT_LINES } from '#gw2/professions/thief/data/trait-lines.js';
import { SPECTER_SKILL_FIELDS } from '#gw2/professions/thief/specializations/specter/catalog-fields.js';
import { specterHooks } from '#gw2/professions/thief/specializations/specter/hooks.js';
import { specterUi } from '#gw2/professions/thief/specializations/specter/presentation.js';
import { SPECTER_SKILLS } from '#gw2/professions/thief/specializations/specter/skills/index.js';
import { projectSpecterPlanningState, specterState } from '#gw2/professions/thief/specializations/specter/state.js';
import { specterTraits } from '#gw2/professions/thief/specializations/specter/traits/index.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

export const specterModule = defineNativeModule({
  id: 'Specter',
  data: createNativeModuleData<ThiefSkill>({
    id: 'Specter',
    traitLines: TRAIT_LINES,

    skillFields: SPECTER_SKILL_FIELDS,
    skills: SPECTER_SKILLS
  }),
  state: { create: specterState.create, project: projectSpecterPlanningState },
  traitDefinitions: specterTraits,
  hooks: specterHooks,
  presentation: specterUi
});
