import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import { TRAIT_LINES } from '#gw2/professions/elementalist/data/trait-lines.js';
import { ELEMENTALIST_CATALYST_PROFILE_FIELDS } from '#gw2/professions/elementalist/specializations/catalyst/catalog-fields.js';
import { catalystHooks } from '#gw2/professions/elementalist/specializations/catalyst/hooks.js';
import { catalystUi } from '#gw2/professions/elementalist/specializations/catalyst/presentation.js';
import { CATALYST_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/catalyst/skills/index.js';
import {
  catalystState,
  projectCatalystPlanningState
} from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import { catalystTraits } from '#gw2/professions/elementalist/specializations/catalyst/traits/index.js';
import type { ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/**
 * Assembles the Catalyst specialization module: skill data and traits,
 * the live Catalyst state, the energy and
 * Elemental Empowerment mechanics, and the accepted-event reactions that turn auras,
 * combo finishers, control effects and buff applications into Catalyst trait procs.
 */
export const catalystModule = defineNativeModule({
  id: 'Catalyst',
  traitDefinitions: catalystTraits,
  data: createNativeModuleData<ElementalistSkill>({
    id: 'Catalyst',
    traitLines: TRAIT_LINES,
    profileFields: ELEMENTALIST_CATALYST_PROFILE_FIELDS,
    skills: materializeSkillDefinitions(CATALYST_SKILL_MECHANICS)
  }),
  state: { create: catalystState.create, project: projectCatalystPlanningState },
  hooks: catalystHooks,
  presentation: catalystUi
});
