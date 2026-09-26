import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createGuardianModuleData } from '#gw2/professions/guardian/data/module-data.js';
import { willbenderAttributeRules } from '#gw2/professions/guardian/specializations/willbender/mechanics/virtue-rules.js';
import { willbenderHooks } from '#gw2/professions/guardian/specializations/willbender/hooks.js';
import { WILLBENDER_SKILL_MECHANICS } from '#gw2/professions/guardian/specializations/willbender/skills/index.js';
import { willbenderState } from '#gw2/professions/guardian/specializations/willbender/state.js';

import { bindWillbenderUi } from '#gw2/professions/guardian/specializations/willbender/presentation.js';
import { WILLBENDER_BALANCE_PROFILES } from '#gw2/professions/guardian/specializations/willbender/profiles.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const willbenderModule = defineNativeModule({
  id: 'Willbender',
  data: createGuardianModuleData('Willbender', {
    skillMechanics: WILLBENDER_SKILL_MECHANICS,

    balanceProfiles: WILLBENDER_BALANCE_PROFILES
  }),
  state: { create: willbenderState.create },
  modifiers: willbenderAttributeRules,
  hooks: willbenderHooks,
  presentation: bindWillbenderUi
});
