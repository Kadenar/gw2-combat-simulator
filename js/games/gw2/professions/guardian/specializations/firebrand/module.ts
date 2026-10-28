import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createGuardianModuleData } from '#gw2/professions/guardian/data/module-data.js';
import {
  FIREBRAND_SKILL_FIELDS,
  GUARDIAN_FIREBRAND_PROFILE_FIELDS
} from '#gw2/professions/guardian/specializations/firebrand/catalog-fields.js';
import { firebrandHooks } from '#gw2/professions/guardian/specializations/firebrand/hooks.js';
import { bindFirebrandUi } from '#gw2/professions/guardian/specializations/firebrand/presentation.js';
import { FIREBRAND_SKILL_MECHANICS } from '#gw2/professions/guardian/specializations/firebrand/skills/index.js';
import { ashesBurningSkill } from '#gw2/professions/guardian/specializations/firebrand/skills/tome-skills.js';
import {
  firebrandState,
  projectFirebrandPlanningState
} from '#gw2/professions/guardian/specializations/firebrand/state.js';
import { firebrandTraits } from '#gw2/professions/guardian/specializations/firebrand/traits/index.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const firebrandModule = defineNativeModule({
  id: 'Firebrand',
  data: createGuardianModuleData('Firebrand', {
    profileFields: GUARDIAN_FIREBRAND_PROFILE_FIELDS,
    extraSkills: [ashesBurningSkill],
    skillFields: FIREBRAND_SKILL_FIELDS,
    skillMechanics: FIREBRAND_SKILL_MECHANICS
  }),
  state: {
    // Initialize pages from the selected patch's compiled trait profiles.
    create: (config, { balanceContext }) =>
      firebrandState.create({ config, balanceProfile: (id) => balanceContext.catalog.balanceProfilesById.get(id) }),
    project: projectFirebrandPlanningState
  },
  traitDefinitions: firebrandTraits,
  hooks: firebrandHooks,
  presentation: bindFirebrandUi
});
