import { createPublicStateProjector } from '#gw2/platform/engine/profession/state.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createGuardianModuleData } from '#gw2/professions/guardian/data/module-data.js';
import { firebrandHooks } from '#gw2/professions/guardian/specializations/firebrand/hooks.js';
import { bindFirebrandUi } from '#gw2/professions/guardian/specializations/firebrand/presentation.js';
import { FIREBRAND_BALANCE_PROFILES } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';
import { FIREBRAND_SKILL_MECHANICS } from '#gw2/professions/guardian/specializations/firebrand/skills/index.js';
import { FIREBRAND_PUBLIC_STATE_PROJECTION } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import { firebrandTraits } from '#gw2/professions/guardian/specializations/firebrand/traits/index.js';
import { createFirebrandState } from '#gw2/professions/guardian/specializations/firebrand/initial-state.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const firebrandModule = defineNativeModule({
  id: 'Firebrand',
  data: createGuardianModuleData('Firebrand', {
    skillMechanics: FIREBRAND_SKILL_MECHANICS,

    balanceProfiles: FIREBRAND_BALANCE_PROFILES
  }),
  state: { create: createFirebrandState, project: createPublicStateProjector(FIREBRAND_PUBLIC_STATE_PROJECTION) },
  traitDefinitions: firebrandTraits,
  hooks: firebrandHooks,
  presentation: bindFirebrandUi
});
