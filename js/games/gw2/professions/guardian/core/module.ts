import { GUARDIAN_CORE_PROFILE_FIELDS } from '#gw2/professions/guardian/core/catalog-fields.js';
import { GUARDIAN_CORE_TRAIT_SKILLS } from '#gw2/professions/guardian/core/skills/trait-skills.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { guardianCoreHooks } from '#gw2/professions/guardian/core/hooks.js';
import { bindGuardianCoreUi } from '#gw2/professions/guardian/core/presentation.js';
import { GUARDIAN_CORE_SKILL_FIELDS } from '#gw2/professions/guardian/core/catalog-fields.js';
import { guardianPassiveAttributes } from '#gw2/professions/guardian/core/skills/attribute-passives.js';
import {
  GUARDIAN_CORE_EXTRA_SKILLS,
  GUARDIAN_CORE_SKILL_MECHANICS
} from '#gw2/professions/guardian/core/skills/index.js';
import { createGuardianCoreState, projectGuardianPlanningState } from '#gw2/professions/guardian/core/state.js';
import { guardianCoreTraits } from '#gw2/professions/guardian/core/traits/index.js';
import { createGuardianModuleData } from '#gw2/professions/guardian/data/module-data.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const guardianCoreModule = defineNativeModule({
  attributes: guardianPassiveAttributes,
  id: 'Core',
  traitDefinitions: guardianCoreTraits,
  data: createGuardianModuleData('Core', {
    profileFields: GUARDIAN_CORE_PROFILE_FIELDS,
    skillMechanics: GUARDIAN_CORE_SKILL_MECHANICS,
    extraSkills: [...GUARDIAN_CORE_EXTRA_SKILLS, ...GUARDIAN_CORE_TRAIT_SKILLS],
    skillFields: GUARDIAN_CORE_SKILL_FIELDS
  }),
  state: { create: createGuardianCoreState, project: projectGuardianPlanningState },
  hooks: guardianCoreHooks,
  presentation: bindGuardianCoreUi
});
