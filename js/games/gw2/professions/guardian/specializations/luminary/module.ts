import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createGuardianModuleData } from '#gw2/professions/guardian/data/module-data.js';
import { luminaryAttributeRules } from '#gw2/professions/guardian/specializations/luminary/mechanics/radiant-forge-rules.js';
import { luminaryHooks } from '#gw2/professions/guardian/specializations/luminary/hooks.js';
import {
  LUMINARY_SKILL_MECHANICS,
  LUMINARY_EXTRA_SKILLS
} from '#gw2/professions/guardian/specializations/luminary/skills/index.js';
import { luminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';

import { bindLuminaryUi } from '#gw2/professions/guardian/specializations/luminary/presentation.js';
import { LUMINARY_BALANCE_PROFILES } from '#gw2/professions/guardian/specializations/luminary/profiles.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const luminaryModule = defineNativeModule({
  id: 'Luminary',
  data: createGuardianModuleData('Luminary', {
    skillMechanics: LUMINARY_SKILL_MECHANICS,
    extraSkills: LUMINARY_EXTRA_SKILLS,
    balanceProfiles: LUMINARY_BALANCE_PROFILES
  }),
  state: { create: luminaryState.create },
  modifiers: luminaryAttributeRules,
  hooks: luminaryHooks,
  presentation: bindLuminaryUi
});
