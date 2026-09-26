import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createGuardianModuleData } from '#gw2/professions/guardian/data/module-data.js';
import { dragonhunterAttributeRules } from '#gw2/professions/guardian/specializations/dragonhunter/mechanics/virtues-and-traps.js';
import { dragonhunterHooks } from '#gw2/professions/guardian/specializations/dragonhunter/hooks.js';
import { DRAGONHUNTER_SKILL_MECHANICS } from '#gw2/professions/guardian/specializations/dragonhunter/skills/index.js';
import { dragonhunterState } from '#gw2/professions/guardian/specializations/dragonhunter/state.js';

import { bindDragonhunterUi } from '#gw2/professions/guardian/specializations/dragonhunter/presentation.js';
import { DRAGONHUNTER_BALANCE_PROFILES } from '#gw2/professions/guardian/specializations/dragonhunter/profiles.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const dragonhunterModule = defineNativeModule({
  id: 'Dragonhunter',
  data: createGuardianModuleData('Dragonhunter', {
    skillMechanics: DRAGONHUNTER_SKILL_MECHANICS,

    balanceProfiles: DRAGONHUNTER_BALANCE_PROFILES
  }),
  state: { create: dragonhunterState.create },
  modifiers: dragonhunterAttributeRules,
  hooks: dragonhunterHooks,
  presentation: bindDragonhunterUi
});
