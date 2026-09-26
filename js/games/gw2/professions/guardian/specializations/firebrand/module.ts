import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createGuardianModuleData } from '#gw2/professions/guardian/data/module-data.js';
import { firebrandAttributeRules } from '#gw2/professions/guardian/specializations/firebrand/mechanics/tomes-and-mantras.js';
import { firebrandLiveMechanics } from '#gw2/professions/guardian/specializations/firebrand/live.js';
import { FIREBRAND_SKILL_MECHANICS } from '#gw2/professions/guardian/specializations/firebrand/skills/index.js';
import { firebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';

import { bindFirebrandUi } from '#gw2/professions/guardian/specializations/firebrand/presentation.js';
import { FIREBRAND_BALANCE_PROFILES } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const firebrandModule = defineNativeModule({
  id: 'Firebrand',
  data: createGuardianModuleData('Firebrand', {
    skillMechanics: FIREBRAND_SKILL_MECHANICS,

    balanceProfiles: FIREBRAND_BALANCE_PROFILES
  }),
  state: { create: firebrandState.create },
  mechanics: { modifiers: firebrandAttributeRules, live: firebrandLiveMechanics },
  presentation: bindFirebrandUi
});
