import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { guardianCoreHooks } from '#gw2/professions/guardian/core/hooks.js';
import { guardianCoreModifiers } from '#gw2/professions/guardian/core/modifiers.js';
import { bindGuardianCoreUi } from '#gw2/professions/guardian/core/presentation.js';
import { GUARDIAN_CORE_BALANCE_PROFILES } from '#gw2/professions/guardian/core/profiles.js';
import {
  GUARDIAN_CORE_EXTRA_SKILLS,
  GUARDIAN_CORE_SKILL_MECHANICS
} from '#gw2/professions/guardian/core/skills/index.js';
import { createGuardianCoreState, projectGuardianPlanningState } from '#gw2/professions/guardian/core/state.js';
import { guardianCoreTraits } from '#gw2/professions/guardian/core/traits/index.js';
import { createGuardianModuleData } from '#gw2/professions/guardian/data/module-data.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const guardianCoreModule = defineNativeModule({
  id: 'Core',
  traitDefinitions: guardianCoreTraits,
  data: createGuardianModuleData('Core', {
    skillMechanics: GUARDIAN_CORE_SKILL_MECHANICS,
    extraSkills: GUARDIAN_CORE_EXTRA_SKILLS,
    balanceProfiles: GUARDIAN_CORE_BALANCE_PROFILES
  }),
  state: { create: createGuardianCoreState, project: projectGuardianPlanningState },
  modifiers: guardianCoreModifiers,
  hooks: guardianCoreHooks,
  presentation: bindGuardianCoreUi
});
