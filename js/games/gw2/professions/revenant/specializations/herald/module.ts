import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createRevenantModuleData } from '#gw2/professions/revenant/data/module-data.js';
import { heraldAttributeRules } from '#gw2/professions/revenant/specializations/herald/mechanics/facet-rules.js';
import { heraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import { heraldUi } from '#gw2/professions/revenant/specializations/herald/presentation.js';
import { HERALD_BASE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/herald/skills/index.js';
import { HERALD_BALANCE_PROFILES } from '#gw2/professions/revenant/specializations/herald/profiles.js';
import { heraldLiveMechanics } from '#gw2/professions/revenant/specializations/herald/live.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const heraldModule = defineNativeModule({
  id: 'Herald',
  data: createRevenantModuleData('Herald', {
    skillMechanics: HERALD_BASE_SKILL_MECHANICS,
    balanceProfiles: HERALD_BALANCE_PROFILES
  }),
  state: { create: heraldState.create },
  mechanics: { modifiers: heraldAttributeRules, live: heraldLiveMechanics },
  presentation: heraldUi
});
